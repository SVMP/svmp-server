/*
 * Copyright 2013-2014 The MITRE Corporation, All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this work except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author Dave Bryson
 * @author Joe Portner
 * @author David Keppler
 *
 */
var
    svmp = require('../svmp'),
    auth = require('../authentication/'),
    net = require('net'),
    http = require('q-io/http'),
    framedSocket = require('./framedsocket');

/**
 * States used by proxy
 */
var UNAUTHENTICATED = 1;
var VMREADY_WAIT = 2;
var PROXYREADY = 3;

exports.handleConnection = function (clientSocket) {
    // helper function to send JSON message as a Response protobuf
    clientSocket.response = function(message) {
        clientSocket.send(svmp.protocol.writeResponse(message), {binary: true});
    };

    // these are common variables that we can't initialize outside of the function
    var logDebug = svmp.config.get('log_level') === 'debug',
        logSilly = svmp.config.get('log_level') === 'silly',
        videoResponseObj = svmp.config.getVideoResponse();

    // we have to store state variables in the clientSocket object
    clientSocket.info = {
        'state': UNAUTHENTICATED,
        'vmSocket': framedSocket.wrap(new net.Socket()),
        'vmSocketClosed': false,
        'clientSocketClosed': false,
        'remoteAddress': clientSocket.upgradeReq.connection.remoteAddress,
        'remotePort': clientSocket.upgradeReq.connection.remotePort
    };

    svmp.logger.info('New connection from ' + clientSocket.info.remoteAddress + ":" + clientSocket.info.remotePort);

    // 1) Check validity of the provided auth token
    svmp.logger.debug('Attempting to authenticate...');

    auth.authenticate(clientSocket.upgradeReq)
    .then(function (obj) {
        clientSocket.info.vmSession = obj;
        clientSocket.info.username = obj.username; // store this separately from vmSession
        svmp.logger.info("User: '%s' authenticated", clientSocket.info.username);

        // Connect to VM after setup
        var params = svmp.config.getRestParams("services/cloud/setupVm/" + clientSocket.info.username);
        http.request(params)
        .then(function (response) {
            if (response.status != 200)
                throw new Error("REST API rejected setupVm request, code: " + response.status);
            return response.body.read(); // this is a promise
        }).then(function (body) {
            var user = JSON.parse(body);

            clientSocket.info.vmSocket.connect(user.vm_port, user.vm_ip, function () {
                svmp.logger.info("User: '%s' connected to VM at %s:%s", clientSocket.info.username, user.vm_ip, user.vm_port);
                clientSocket.info.state = VMREADY_WAIT;

                // send json VIDEO_INFO
                clientSocket.info.vmSocket.write(svmp.protocol.writeRequest({"type": "VIDEO_PARAMS", "videoInfo": videoResponseObj}));

                svmp.logger.verbose("State changed to VMREADY_WAIT");
            });
        }).catch( function (err) {
            clientSocket.response({type: 'ERROR'});
            clientSocket.close(4001, 'setup.onLogin failed: ' + err.message);
        }).done();

    }).catch( function (err) {
        svmp.logger.info("Client " +
            clientSocket.info.remoteAddress + ":" +
            clientSocket.info.remotePort + " failed authentication: " + err);
        clientSocket.response({type: 'AUTH', authResponse: {type: 'AUTH_FAIL'}});
        clientSocket.close(4002, 'Failed authentication: ' + err.message);
    }).done();

    clientSocket.on('message', function (message, flags) {
        if (flags.binary) {
            if (clientSocket.info.state === PROXYREADY ) {
                if (logDebug || logSilly)
                    // client requests are delimited for the VM
                    svmp.protocol.parseRequestDelimited(message); // parse the request and log it
                clientSocket.info.vmSocket.write(message);
            }
        } else {
            // unexpected string message
            // ignore it
        }
    });

    clientSocket.info.vmSocket.on('message', function (message) {

        if (clientSocket.info.state === VMREADY_WAIT) {
            var response = svmp.protocol.parseResponse(message);
            if (response.type === 'VMREADY') {
                clientSocket.info.state = PROXYREADY;
                svmp.logger.verbose("State changed to PROXYREADY");
                // the proxy is now ready for normal activity, create an interval to monitor this vmSession
                startVMSessionTimeout();
            }
        }
        else if (logDebug || logSilly)
            svmp.protocol.parseResponse(message); // parse the response and log it

        clientSocket.send(message, {binary: true});
    });

    /**
     * When the client socket closes, close the VM connection
     */
    clientSocket.on("close", function (code, message) {
        svmp.logger.verbose("clientSocket closed: (" + code + ") " + message);
        shutdownClient();
    });

    /**
     * If the client socket runs into an error, shut everything down
     */
    clientSocket.on("error", function (err) {
        // prevent spam before the socket closes
        if (!clientSocket.info.clientSocketClosed) {
            svmp.logger.error("clientSocket:", err);
        }
        shutdownClient();
    });

    /**
     * When the VM socket closes, close the client connection
     */
    clientSocket.info.vmSocket.on('close', function (had_error) {
        svmp.logger.verbose("vmSocket closed");
        shutdownVM();
    });

    /**
     * If the VM socket times out, shut everything down
     */
    clientSocket.info.vmSocket.on('timeout', function () {
        svmp.logger.verbose("vmSocket timed out");
        shutdownVM();
    });

    /**
     * If the VM socket runs into an error, shut everything down
     */
    clientSocket.info.vmSocket.on("error", function (err) {
        // prevent spam before the socket closes
        if (!clientSocket.info.vmSocketClosed) {
            svmp.logger.error("vmSocket:", err);
        }
        shutdownVM();
    });

    /*
     * Ensures that sockets and intervals are closed, and that vmSession information has been updated
     * This function shuts down the client socket first, then the VM socket
     */
    function shutdownClient() {
        if (!clientSocket.info.clientSocketClosed) {
            clientSocket.info.clientSocketClosed = true;
            if (clientSocket.info.username == null) {
                svmp.logger.info('Client disconnected: %s:%s', clientSocket.info.remoteAddress, clientSocket.info.remotePort);
            } else {
                svmp.logger.info("Client disconnected: user '%s' from %s:%s",
                    clientSocket.info.username, clientSocket.info.remoteAddress, clientSocket.info.remotePort);
            }

            // the user disconnected, inform the REST API server
            updateVMSession();

            // stop the timeout for vmSession management
            stopVMSessionTimeout();

            clientSocket.terminate();

            // now that the client socket is closed, we can close the VM socket
            shutdownVM();
        }
    }

    /*
     * Ensures that sockets and intervals are closed, and that vmSession information has been updated
     * This function shuts down the VM socket first, then the client socket
     */
    function shutdownVM() {
        if (!clientSocket.info.vmSocketClosed) {
            clientSocket.info.vmSocketClosed = true;
            try {
                clientSocket.info.vmSocket.end();
                clientSocket.info.vmSocket.destroy();
            } catch (e) {
                svmp.logger.error("Error closing VM socket: " + e);
            }

            // now that the VM socket is closed, we can close the client socket
            shutdownClient();
        }
    }

    /**
     * Informs the REST API server that the vmSession is no longer active; this starts the idle
     * VM termination countdown
     */
    function updateVMSession() {
        if (clientSocket.info.vmSession != null) {
            var args = clientSocket.info.vmSession;
            clientSocket.info.vmSession = null; // prevent the vmSession timeout from firing off

            svmp.vmSession.updateActivity(args)
            .then(function (result) {
                svmp.logger.verbose("vmSession for '%s' updated successfully", clientSocket.info.username);
            }).catch(function (err) {
                svmp.logger.error("updateVMSession failed:", err);
            }).done();
        }
    }

    /**
     * Runs a timeout to terminate idle vmSessions
     */
    function startVMSessionTimeout() {
        if (clientSocket.info.vmSession === null)
            return;

        var expireMillis = (new Date(clientSocket.info.vmSession.expireAt) - new Date());
        svmp.logger.verbose("vmSession for '%s' expires in %d seconds", clientSocket.info.username, expireMillis / 1000);

        clientSocket.info.vmSessionTimeout = setTimeout(
            function () {
                if (clientSocket.info.vmSession === null) {
                    // in rare cases, this timeout can kick off after this socket has been closed
                    // in that case, make sure the interval is stopped, then exit the function
                    stopVMSessionTimeout();
                    return;
                }

                svmp.logger.info("vmSession for '%s' is expired, terminating connection", clientSocket.info.username);

                clientSocket.response({type: "AUTH", authResponse: {type: "SESSION_MAX_TIMEOUT"}});
                clientSocket.close(4002, "SESSION_MAX_TIMEOUT");

                // we don't want to try to update this vmSession's lastAction attribute to the REST API server
                clientSocket.info.vmSession = null;

                // close the connection
                shutdownClient();
            },
            expireMillis
        );
    }

    /*
     * Stops the interval that is running
     */
    function stopVMSessionTimeout() {
        if (clientSocket.info.vmSessionTimeout !== null) {
            clearTimeout(clientSocket.info.vmSessionTimeout);
            clientSocket.info.vmSessionTimeout = null;
        }
    }

};

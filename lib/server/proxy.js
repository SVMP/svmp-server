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

    var state = UNAUTHENTICATED,
        logDebug = svmp.config.get('settings:log_level') === 'debug',
        logSilly = svmp.config.get('settings:log_level') === 'silly',
        vmSocket = framedSocket.wrap(new net.Socket());
        vmSocketClosed = false,
        clientSocketClosed = false,
        vmSession = null,
        vmSessionTimeout = null,
        videoResponseObj = svmp.config.getVideoResponse();

    var remoteAddress = clientSocket.upgradeReq.connection.remoteAddress,
        remotePort = clientSocket.upgradeReq.connection.remotePort,
        username = null;

    svmp.logger.info('New connection from ' + remoteAddress + ":" + remotePort);

    // 1) Check validity of the provided auth token
    svmp.logger.debug('Attempting to authenticate...');

    auth.authenticate(clientSocket.upgradeReq)
    .then(function (obj) {
        vmSession = obj;
        username = vmSession.username;
        svmp.logger.info("User: '%s' authenticated", username);

        // Connect to VM after setup
        var params = svmp.config.getRestParams("/services/cloud/setupVm/" + username);
        http.request(params)
        .then(function (response) {
            if (response.status != 200)
                throw new Error("REST API rejected setupVm request, code: " + response.status);
            return response.body.read(); // this is a promise
        }).then(function (body) {
            var user = JSON.parse(body);

            vmSocket.connect(user.vm_port, user.vm_ip, function () {
                svmp.logger.info("User: '%s' connected to VM at %s:%s", username, user.vm_ip, user.vm_port);
                state = VMREADY_WAIT;

                // send json VIDEO_INFO
                vmSocket.write(svmp.protocol.writeRequest({"type": "VIDEO_PARAMS", "videoInfo": videoResponseObj}));

                svmp.logger.verbose("State changed to VMREADY_WAIT");
            });
        }).catch( function (err) {
            clientSocket.response({type: 'ERROR', message: err.message});
            clientSocket.close(4001, 'setup.onLogin failed: ' + err.message);
        }).done();

    }).catch( function (err) {
        clientSocket.response({type: 'AUTH', authResponse: {type: 'AUTH_FAIL'}});
        clientSocket.close(4002, 'Failed authentication: ' + err.stack);
    }).done();

    clientSocket.on('message', function (message, flags) {
        if (flags.binary) {
            if (state === PROXYREADY ) {
                if (logDebug || logSilly)
                    // client requests are delimited for the VM
                    svmp.protocol.parseRequestDelimited(message); // parse the request and log it
                vmSocket.write(message);
            }
        } else {
            // unexpected string message
            // ignore it
        }
    });

    vmSocket.on('message', function (message) {

        if (state === VMREADY_WAIT) {
            var response = svmp.protocol.parseResponse(message);
            if (response.type === 'VMREADY') {
                state = PROXYREADY;
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
        shutdown();
    });

    /**
     * If the client socket runs into an error, shut everything down
     */
    clientSocket.on("error", function (err) {
        svmp.logger.error("clientSocket:", err);
        shutdown();
    });

    /**
     * When the VM socket closes, close the client connection
     */
    vmSocket.on('close', function (had_error) {
        svmp.logger.verbose("vmSocket closed");
        shutdown();
    });

    /**
     * If the VM socket times out, shut everything down
     */
    vmSocket.on('timeout', function () {
        svmp.logger.verbose("vmSocket timed out");
        shutdown();
    });

    /**
     * If the VM socket runs into an error, shut everything down
     */
    vmSocket.on("error", function (err) {
        svmp.logger.error("vmSocket:", err);
        shutdown();
    });

    /*
     * Ensures that sockets and intervals are closed, and that vmSession information has been updated
     */
    function shutdown() {
        if (!clientSocketClosed) {
            clientSocketClosed = true;
            if (username == null) {
                svmp.logger.info('Client disconnected: %s:%s', remoteAddress, remotePort);
            } else {
                svmp.logger.info("Client disconnected: user '%s' from %s:%s",
                    username, remoteAddress, remotePort);
            }

            // the user disconnected, inform the REST API server
            updateVMSession();

            // stop the timeout for vmSession management
            stopVMSessionTimeout();

            clientSocket.terminate();
        }
        if (!vmSocketClosed) {
            vmSocketClosed = true;
            try {
                vmSocket.end();
                vmSocket.destroy();
            } catch (e) {
                svmp.logger.error("Error closing VM socket: " + e);
            }
        }
    }

    /**
     * Informs the REST API server that the vmSession is no longer active; this starts the idle
     * VM termination countdown
     */
    function updateVMSession() {
        if (vmSession != null) {
            var sid = vmSession.sid;
            vmSession = null; // prevent the vmSession timeout from firing off
            svmp.vmSession.updateActivity(sid)
            .then(function (result) {
                svmp.logger.verbose("vmSession for '%s' updated successfully", username);
            }).catch(function (err) {
                svmp.logger.error("updateVMSession failed:", err);
            }).done();
        }
    }

    /**
     * Runs a timeout to terminate idle vmSessions
     */
    function startVMSessionTimeout() {
        if (vmSession === null)
            return;

        var expireMillis = (new Date(vmSession.expireAt) - new Date());
        svmp.logger.verbose("vmSession for '%s' expires in %d seconds", username, expireMillis / 1000);

        vmSessionTimeout = setTimeout(
            function () {
                if (vmSession === null) {
                    // in rare cases, this timeout can kick off after this socket has been closed
                    // in that case, make sure the interval is stopped, then exit the function
                    stopVMSessionTimeout();
                    return;
                }

                svmp.logger.info("vmSession for '%s' is expired, terminating connection", username);

                clientSocket.response({type: "AUTH", authResponse: {type: "SESSION_MAX_TIMEOUT"}});
                clientSocket.close(4002, "SESSION_MAX_TIMEOUT");

                // we don't want to try to update this vmSession's lastAction attribute to the REST API server
                vmSession = null;

                // close the connection
                shutdown();
            },
            expireMillis
        );
    }

    /*
     * Stops the interval that is running
     */
    function stopVMSessionTimeout() {
        if (vmSessionTimeout !== null) {
            clearTimeout(vmSessionTimeout);
            vmSessionTimeout = null;
        }
    }

};

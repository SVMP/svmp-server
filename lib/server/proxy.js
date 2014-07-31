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
 *
 */
var
    svmp = require('../svmp'),
    net = require('net'),
    framedSocket = require('./framedsocket');

/**
 * States used by proxy
 */
var UNAUTHENTICATED = 1;
var VMREADY_WAIT = 2;
var VMREADY_SENT = 3;
var PROXYREADY = 4;


// TODO: THIS NEEDS TESTING

exports.handleConnection = function (clientSocket,authenticator) {
    var state = UNAUTHENTICATED,
        logDebug = svmp.config.get('settings:log_level') === 'debug',
        logSilly = svmp.config.get('settings:log_level') === 'silly',
        vmSocket = framedSocket.wrap(new net.Socket());
        vmSocketClosed = false,
        clientSocketClosed = false,
        session = null,
        sessionInterval = null,
        videoResponseObj = svmp.config.getVideoResponse();

    var username = "";

    // The underlying problem is now fixed in the VM. A reconnecting client
    // will cause any zombie server->VM connection to be terminated freeing
    // up the VM for the new connection so we don't need short timeouts any
    // more as a workaround.

    // As an upper limite, set it equal to the idle timeout for the VM itself
    clientSocket.setTimeout(svmp.config.get('settings:vm_idle_ttl') * 60 * 1000);

    clientSocket.on('message', function (message) {

        switch (state) {
            case UNAUTHENTICATED:
                var request = svmp.protocol.parseRequest(message);

                svmp.logger.debug('Attempting to authenticate...');

                authenticator.authenticate(request)
                    .then(function (useSessionObj) {
                        session = useSessionObj.session;
                        username = useSessionObj.user.username;
                        svmp.logger.info('User: \'%s\' authenticated', useSessionObj.user.username);

                        state = VMREADY_WAIT;

                        var msg = {type: 'AUTH',
                            authResponse: {type: "AUTH_OK",
                                sessionInfo: {
                                    token: session.sid,
                                    maxLength: svmp.config.get('settings:max_session_length'),
                                    gracePeriod: svmp.config.get('settings:session_token_ttl')
                                }}};

                        // Send Auth OK
                        //clientSocket.sendResponse(msg);
                        clientSocket.write(svmp.protocol.writeResponse(msg));

                        // Connect to VM after setup
                        svmp.cloud.setUpUser(useSessionObj)
                            .then(function (useSessionObj) {
                                var port = svmp.config.get('settings:vm_port');

                                vmSocket.connect(port, useSessionObj.user.vm_ip, function () {
                                    svmp.logger.info('User: \'%s\' connected to VM: %s', useSessionObj.user.username, useSessionObj.user.vm_ip);

                                    // send json VIDEO_INFO
                                    vmSocket.write(svmp.protocol.writeRequest({"type": "VIDEO_PARAMS", "videoInfo": videoResponseObj}));
                                    //vmSocket.sendRequest({"type": "VIDEO_PARAMS", "videoInfo": videoResponseObj});

                                    svmp.logger.verbose("State changed to VMREADY_WAIT");
                                });

                            }, function (err) {
                                svmp.logger.error("setup.onLogin, " + err);
                                clientSocket.write(svmp.protocol.writeResponse({type: 'ERROR', message: err}));
                                //clientSocket.sendResponse({type: 'ERROR', message: err});
                                clientSocket.destroy();
                            }).done();


                    }, function (err) {
                        svmp.logger.info('Failed authentication: ' + err.message);
                        clientSocket.write(svmp.protocol.writeResponse({type: 'AUTH', authResponse: {type: err.responseType}}));
                        clientSocket.destroy();
                    }).done();

                break;
            case VMREADY_SENT:
                var request = svmp.protocol.parseRequest(message);
                if (request.type === 'VIDEO_PARAMS') {

                    // the proxy is now ready for normal activity, create an interval to monitor this session

                    startInterval();

                    // send json VIDEO_INFO
                    clientSocket.write(svmp.protocol.writeResponse({"type": "VIDSTREAMINFO", "videoInfo": videoResponseObj}));
                    //clientSocket.sendResponse({"type": "VIDSTREAMINFO", "videoInfo": videoResponseObj});
                    state = PROXYREADY;
                    svmp.logger.verbose("State changed to PROXYREADY");
                }
                break;
            case PROXYREADY:
                if (logDebug || logSilly)
                    svmp.protocol.parseRequest(message); // parse the request and log it
                vmSocket.write(message);
                //vmSocket.sendRaw(message);
                break;
        }

    });

    vmSocket.on('message', function (message) {

        if (state === VMREADY_WAIT) {
            var response = svmp.protocol.parseResponse(message);
            if (response.type === 'VMREADY') {
                state = VMREADY_SENT;
                svmp.logger.verbose("State changed to VMREADY_SENT");
            }
        }
        else if (logDebug || logSilly)
            svmp.protocol.parseResponse(message); // parse the response and log it

        clientSocket.write(message);
        //clientSocket.sendRaw(message);

    });

    /**
     * When the client socket closes, close the VM connection
     */
    clientSocket.on("close", function (had_error) {
        svmp.logger.verbose("clientSocket closed");
        shutdown();
    });

    /**
     * When the client socket closes, close the VM connection
     */
    clientSocket.on("timeout", function () {
        svmp.logger.verbose("clientSocket timed out");
        shutdown();
    });

    /**
     * If the client socket runs into an error, shut everything down
     */
    clientSocket.on("error", function (err) {
        svmp.logger.error("clientSocket: " + err);
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
        svmp.logger.error("vmSocket: " + err);
        shutdown();
    });

    /*
     * Ensures that sockets and intervals are closed, and that session information has been updated
     */
    function shutdown() {
        if (!clientSocketClosed) {
            clientSocketClosed = true;
            svmp.logger.info('User disconnected: ' + username);

            // the user disconnected, that counts as an action - update the session info accordingly
            updateSession();
            saveSession();

            // stop the interval for session management
            stopInterval();

            try {
                clientSocket.end();
                clientSocket.destroy();
            } catch (e) {
                svmp.logger.error("Error closing proxy socket: " + e);
            }
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
     * Updates session activity to prevent idle termination
     */
    function updateSession() {
        if (session != null)
            session.lastAction = new Date();
    }

    /**
     * Saves session info to the database
     * This is called when the client terminates the connection
     */
    function saveSession() {
        if (session != null)
            session.save(function (err, sess) {
                if (err)
                    svmp.logger.error('Error saving session: ' + err);
            });
    }

    /**
     * Runs on an interval to terminate idle sessions
     */
    function startInterval() {
        updateSession();
        sessionInterval = setInterval(
            function interval() {
                if (session == null) {
                    // in rare cases, this interval can kick off after this socket has been closed
                    // in that case, make sure the interval is stopped, then exit the function
                    stopInterval();
                    return;
                }

                var expired = session.expireAt < new Date();

                // if the session is expired, boot the client
                if (expired) {
                    svmp.logger.info("Session '%s' is expired, terminating connection", session.sid);

                    clientSocket.write(svmp.protocol.writeResponse({type: "AUTH", authResponse: {type: "SESSION_MAX_TIMEOUT"}}));

                    // close the connection
                    shutdown();
                }
                else {
                    svmp.logger.verbose("Session '%s' expires in %d seconds",
                        session.sid, (session.expireAt - new Date()) / 1000);
                }
            },
                svmp.config.get('settings:session_check_interval') * 1000
        );
    }

    /*
     * Stops the interval that is running
     */
    function stopInterval() {
        if (sessionInterval != null) {
            clearInterval(sessionInterval);
            sessionInterval = null;
        }
    }

};


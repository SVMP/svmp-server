/*
 * Copyright 2013 The MITRE Corporation, All Rights Reserved.
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
    proto = require('./protocol'),
    svmp = require('../svmp'),
    svmpSocket = require('./svmpsocket');

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
        vmSocket = new svmpSocket.SvmpSocket(),
        vmSocketClosed = false,
        proxySocketClosed = false,
        session = null,
        sessionInterval = null,
        videoResponseObj = svmp.config.getVideoResponse();

    var username = "";

    // time out the client socket after 60 seconds of inactivity
    // prevents the server->VM connection from being blocked up by a
    // client that silently hung up without closing the socket properly
    //clientSocket.setTimeout(60 * 1000);

    clientSocket.on('message', function (message) {

        switch (state) {
            case UNAUTHENTICATED:
                var request = svmp.protocol.parseRequest(message);

                username = request.authRequest.username;
                svmp.logger.debug('Attempting to authenticate \'%s\'', username);

                authenticator.authenticate(request)
                    .then(function (useSessionObj) {
                        session = useSessionObj.session;
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
                        clientSocket.sendResponse(msg);

                        // Connect to VM after setup
                        svmp.openstack.setUpUser(useSessionObj)
                            .then(function (useSessionObj) {
                                var port = svmp.config.get('settings:vm_port');

                                vmSocket.connect(port, useSessionObj.user.vm_ip, function () {
                                    svmp.logger.info('User: \'%s\' connected to VM: %s', useSessionObj.user.username, useSessionObj.user.vm_ip);

                                    // send json VIDEO_INFO
                                    vmSocket.sendRequest({"type": "VIDEO_PARAMS", "videoInfo": videoResponseObj});

                                    svmp.logger.verbose("State changed to VMREADY_WAIT");
                                });

                            }, function (err) {
                                svmp.logger.error("setup.onLogin, " + err);
                                var error_resp = proto.writeResponse({type: 'ERROR', message: err});
                                clientSocket.end(error_resp);
                            }).done();


                    }, function (err) {
                        svmp.logger.info('Failed authentication: ' + err);
                        var error_resp = proto.writeResponse({type: 'AUTH', authResponse: {type: "AUTH_FAIL"}});
                        clientSocket.end(error_resp);
                    }).done();

                break;
            case VMREADY_SENT:
                var request = svmp.protocol.parseRequest(message);
                if (request.type === 'VIDEO_PARAMS') {

                    // the proxy is now ready for normal activity, create an interval to monitor this session

                    startInterval();

                    // send json VIDEO_INFO
                    clientSocket.sendResponse({"type": "VIDSTREAMINFO", "videoInfo": videoResponseObj});
                    state = PROXYREADY;
                    svmp.logger.verbose("State changed to PROXYREADY");
                }
                break;
            case PROXYREADY:
                if (logDebug || logSilly)
                    svmp.protocol.parseRequest(message); // parse the request and log it

                vmSocket.sendRaw(message);
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

        clientSocket.sendRaw(message);

    });

    /**
     * When the client socket closes, close the VM connection
     */
    clientSocket.on("close", function (had_error) {
        svmp.logger.verbose("proxySocket closed");
        shutdown();
    });

    /**
     * When the client socket closes, close the VM connection
     */
    //clientSocket.on("timeout", function (had_error) {
    //    svmp.logger.verbose("proxySocket timed out");
    //    shutdown();
    //});

    /**
     * If the client socket runs into an error, shut everything down
     */
    clientSocket.on("error", function (err) {
        svmp.logger.error("proxySocket: " + err);
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
        if (!proxySocketClosed) {
            proxySocketClosed = true;
            svmp.logger.info('User disconnected: ' + username);

            // the user disconnected, that counts as an action - update the session info accordingly
            updateSession();
            saveSession();

            // stop the interval for session management
            stopInterval();

            try {
                clientSocket.destroy();
            } catch (e) {
                svmp.logger.error("Error closing proxy socket: " + e);
            }
        }
        if (!vmSocketClosed) {
            vmSocketClosed = true;
            try {
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
                var expired = session.expireAt < new Date();

                // if the session is expired, boot the client
                if (expired) {
                    svmp.logger.info("Session '%s' is expired, terminating connection", session.sid);

                    clientSocket.sendResponse({type: "AUTH", authResponse: {type: "SESSION_MAX_TIMEOUT"}});

                    // close the connection
                    clientSocket.end();
                    vmSocket.end();
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


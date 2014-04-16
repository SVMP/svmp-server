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
 * author Dave Bryson
 *
 */
'use strict';

var net = require('net'),
    proto = require('./protocol'),
    settings = global.config.settings,
    webrtc = global.config.webrtc,
    winston = require('winston'),
    setup = require('./setupuser'),
    ByteBuffer = require('bytebuffer');
/**
 * States used by proxy
 */
var UNAUTHENTICATED = 1;
var VMREADY_WAIT = 2;
var VMREADY_SENT = 3;
var PROXYREADY = 4;


/**
 *  Generate videoinfo message from config 
 */ 
function videoResponse() {
    // Stringify parameters
    var ice = JSON.stringify(webrtc.ice);
    var video = JSON.stringify(webrtc.video);
    var pc = JSON.stringify(webrtc.pc);
    return { iceServers: ice, pcConstraints: pc, videoConstraints: video };
}

/**
 * Represents a connection from a client
 * @param {Socket} proxySocket
 * @param {Authentication} authenticator
 */
exports.proxyConnection = function proxyConnection(proxySocket, authenticator) {
    var vmSocket = new net.Socket(),
        vmSocketClosed = false,
        proxySocketClosed = false,
        state = UNAUTHENTICATED,
        videoResponseObj = videoResponse(),
        testing = false;

    var session = null,
        sessionInterval = null;

    var tmpbufClient = new Buffer(0),
        tmpbufVM = new Buffer(0);

    proxySocket.on('data', function (data) {
        if (state === PROXYREADY) {
            if (settings.log_level !== 'debug' && settings.log_level !== 'silly') {
                // Proxy data straight through without delay
                vmSocket.write(data);
                return;
            }
        }

        // concat leftovers with new data
        var bb = ByteBuffer.wrap( Buffer.concat( [tmpbufClient, data] ) );

        // read messages until we run out of bytes and fail
        while ( bb.remaining() > 0 ) {
            try {
                bb.mark();
                var msgLen = bb.readVarint32();
                handleRequest(proto.readRequest(bb.slice(bb.offset, bb.offset+msgLen).toBuffer()));
                bb.offset = bb.offset + msgLen;
            } catch (e) {
                // hit the end of the buffer without reading a full varints and message
                // save the leftovers, must include the parts of the initial parts of the varint
                bb.reset();
                tmpbufClient = bb.compact().toBuffer();
                break;
            }
        }
    });

    var handleRequest = function (request) {
        // if the log level is set to debug, try to read the Protobuf request and print its type
        if (settings.log_level === 'debug' || settings.log_level === 'silly') {
            try {
                // if this Request type isn't in our list of filters, log this message
                if (settings.log_request_filter.indexOf(request.type) == -1) {
                    winston.debug("Received request from client: " + request.type);
                    winston.silly("Request body: " + JSON.stringify(request) );
                }
            } catch(e) {
                winston.debug("Error, could not read request: " + e);
            }
        }

        switch (state) {
        case UNAUTHENTICATED:
            try {
                var authObj = proto.parseAuthentication(request);

                if( authObj.testing === 'true') {
                    testing = true;
                }

                /**
                 * This logic (on successful login):
                 * Authenticates
                 * Creates and Starts VM
                 * Attaches Storage
                 * Connects to VM
                 */
                authenticator.authenticate(authObj)
                    .then(function(useSessionObj) {
                        session = useSessionObj.session;
                        winston.info('User: \'%s\' authenticated', useSessionObj.user.username);
                        state = VMREADY_WAIT;
                        proto.sendResponse({type: 'AUTH', authResponse: {type: "AUTH_OK", sessionInfo: {
                                token: session.sid,
                                maxLength: settings.max_session_length,
                                gracePeriod: settings.session_token_ttl
                            }}}, proxySocket);

                        if(testing) {
                            proto.sendResponse({type: 'VMREADY', message: 'Testing. Not connected to VM'}, proxySocket);
                            state = VMREADY_SENT;
                            winston.verbose("State changed to VMREADY_SENT");
                        }
                        else {
                            // User is authenticated; if need be, spin up the VM with attached storage, then connect to the VM
                            setup.onLogin(useSessionObj)
                                .then(function(useSessionObj) {
                                    vmSocket.connect(settings.vm_port, useSessionObj.user.vm_ip, function () {
                                        winston.info('User: \'%s\' connected to VM: %s', useSessionObj.user.username, useSessionObj.user.vm_ip);
                                        // send json VIDEO_INFO
                                        proto.sendRequest({"type": "VIDEO_PARAMS", "videoInfo": videoResponseObj}, vmSocket);
                                        winston.verbose("State changed to VMREADY_WAIT");
                                    });
                                })
                                .catch(function (err) {
                                    winston.error("setup.onLogin, " + err);
                                    var error_resp = proto.writeResponse({type: 'ERROR', message: err});
                                    proxySocket.end(error_resp);
                                })
                                .done();
                        }
                    })
                    .catch(function (err) {
                        winston.info('Failed authentication: ' + err);
                        var error_resp = proto.writeResponse({type: 'AUTH', authResponse: {type: "AUTH_FAIL"}});
                        proxySocket.end(error_resp);
                    })
                    .done();
            } catch(e) {
                var msg = 'Problem parsing message: ' + e;
                proto.sendResponse({type: 'ERROR', message: msg}, proxySocket);
            }

            break;
        case VMREADY_SENT:
            /**
             * Parse request
             * Send Video Information
             * Change state to PROXYREADY
             */
            try {
                 if( request.type === 'VIDEO_PARAMS') {
                    // the proxy is now ready for normal activity, create an interval to monitor this session
                    startInterval();

                    // send json VIDEO_INFO
                    proto.sendResponse({"type": "VIDSTREAMINFO", "videoInfo": videoResponseObj}, proxySocket);
                    state = PROXYREADY;
                    winston.verbose("State changed to PROXYREADY");
                 }
            } catch (e) {
                proto.sendResponse({"type": "ERROR", "message": "Parser: Bad formed message"}, proxySocket);    
            }
            break;
        case PROXYREADY:
            /* IDLE TIMEOUT CODE (not currently used) */
            // if the user touched the screen, update the lastAction Date to prevent idle timeout
            // is there a better way to detect user activity?
//            try {
//                var request = proto.readRequest(data);
//                if (request.type === 'TOUCHEVENT')
//                    updateSession();
//            } catch (e) {
//            }

            /**
             * Proxy data straight through
             */
            proto.sendRequest(request, vmSocket);
            break;
        }
    };

    /**
     * Send data to client
     */
    vmSocket.on('data', function (data) {
        if (state === PROXYREADY) {
            if (settings.log_level !== 'debug' && settings.log_level !== 'silly') {
                // Proxy data straight through without delay
                proxySocket.write(data);
                return;
            }
        }

        // concat leftovers with new data
        var bb = ByteBuffer.wrap( Buffer.concat( [tmpbufVM, data] ) );

        // read messages until we run out of bytes and fail
        while ( bb.remaining() > 0 ) {
            try {
                bb.mark();
                var msgLen = bb.readVarint32();
                handleResponse(proto.readResponse(bb.slice(bb.offset, bb.offset+msgLen).toBuffer()));
                bb.offset = bb.offset + msgLen;
            } catch (e) {
                // hit the end of the buffer without reading a full varints and message
                // save the leftovers, must include the parts of the initial parts of the varint
                bb.reset();
                tmpbufVM = bb.compact().toBuffer();
                break;
            }
        }
    });

    var handleResponse = function (response) {
        // if the log level is set to debug, try to read the Protobuf response and print its type
        if (settings.log_level === 'debug' || settings.log_level === 'silly') {
            try {
                // if this Request type isn't in our list of filters, log this message
                if (settings.log_request_filter.indexOf(response.type) == -1) {
                    winston.debug("Sending response to client: " + response.type);
                    winston.silly("Response body: " + JSON.stringify(response) );
                }
            } catch(e) {
                winston.debug("Error, could not read response: " + e);
            }
        }

        if( state === VMREADY_WAIT) {
            if (response.type === 'VMREADY') {
                state = VMREADY_SENT;
                winston.verbose("State changed to VMREADY_SENT");
            }
        }

        proto.sendResponse(response, proxySocket);
    };

    /**
     * When the client socket closes, close the VM connection
     */
    proxySocket.on("close", function (had_error) {
        winston.verbose("proxySocket closed");
        shutdown();
    });

    /**
     * If the client socket runs into an error, shut everything down
     */
    proxySocket.on("error", function (err) {
        winston.error("proxySocket: " + err);
        shutdown();
    });

    /**
     * When the VM socket closes, close the client connection
     */
    vmSocket.on('close', function (had_error) {
        winston.verbose("vmSocket closed");
        shutdown();
    });

    /**
     * If the VM socket times out, shut everything down
     */
    vmSocket.on('timeout', function () {
        winston.verbose("vmSocket timed out");
        shutdown();
    });

    /**
     * If the VM socket runs into an error, shut everything down
     */
    vmSocket.on("error", function (err) {
        winston.error("vmSocket: " + err);
        shutdown();
    });

    /*
     * Ensures that sockets and intervals are closed, and that session information has been updated
     */
    function shutdown() {
        if (!proxySocketClosed) {
            proxySocketClosed = true;
            winston.info('User disconnected');

            // the user disconnected, that counts as an action - update the session info accordingly
            updateSession();
            saveSession();
            // stop the interval for session management
            stopInterval();

            try {
                proxySocket.destroy();
            } catch (e) {
                winston.error("Error closing proxy socket: " + e);
            }
        }
        if (!vmSocketClosed) {
            vmSocketClosed = true;
            try {
                vmSocket.destroy();
            } catch (e) {
                winston.error("Error closing VM socket: " + e);
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
            session.save(function(err, sess){
                if(err)
                    winston.error('Error saving session: ' + err);
            });
    }

    /**
     * Runs on an interval to terminate idle sessions
     */
    function startInterval() {
        updateSession();
        sessionInterval = setInterval (
            function interval() {
                var expired = session.expireAt < new Date();

                /* IDLE TIMEOUT CODE (not currently used) */
//                var timedOut = (new Date(session.lastAction.getTime() + (settings.session_token_ttl*1000)) - new Date());

                // if the session is expired, boot the client
                if (expired) {
                    winston.info("Session '%s' is expired, terminating connection", session.sid);
                    proto.sendResponse({type: "AUTH", authResponse: {type: "SESSION_MAX_TIMEOUT"}}, proxySocket);

                    // close the connection
                    proxySocket.end();
                    vmSocket.end();
                }
                /* IDLE TIMEOUT CODE (not currently used) */
//                else if (timedOut <= 0) {
//                    winston.info('session is timed out, terminating connection');
//                    proto.sendResponse({type: "AUTH", authResponse: {type: "SESSION_IDLE_TIMEOUT"}}, proxySocket);
//                }
                else {
                    winston.verbose("Session '%s' expires in %d seconds",
                            session.sid, (session.expireAt - new Date()) / 1000);
                }
            },
            settings.session_check_interval * 1000
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

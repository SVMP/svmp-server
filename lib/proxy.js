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
                    if (settings.log_level === 'silly') {
                        winston.debug("Request body: " + JSON.stringify(request) );
                    }
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

                authenticator.authenticate(authObj).then(
                    function(obj) {
                        // we successfully authenticated, store the session for this connection
                        session = obj.session;

                        winston.info('User: \'%s\' authenticated', obj.username);
                        proto.sendResponse({type: 'AUTH', authResponse: {type: "AUTH_OK", sessionToken: session.sid}}, proxySocket);

                        if(testing) {
                            proto.sendResponse({type: 'VMREADY', message: 'Testing. Not connected to VM'}, proxySocket);
                            state = VMREADY_SENT;
                            winston.verbose("State changed to VMREADY_SENT");
                        } else if( obj.vm_ip && obj.vm_ip.length > 0) {
                            // Connect to VM
                            vmSocket.connect(settings.vm_port, obj.vm_ip, function () {
                                winston.info('User: \'%s\' connected to VM: %s', obj.username, obj.vm_ip);

                                // send json VIDEO_INFO
                                proto.sendRequest({"type": "VIDEO_PARAMS", "videoInfo": videoResponseObj}, vmSocket);
                                state = VMREADY_WAIT;
                                winston.verbose("State changed to VMREADY_WAIT");
                            });
                        }
                    },
                    function(err) {
                        winston.info('Failed authentication: ' + err);

                        var error_resp = proto.writeResponse({type: 'AUTH', authResponse: {type: "AUTH_FAIL"}});
                        proxySocket.end(error_resp);
                    }
                ); 
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
                    if (settings.log_level === 'silly') {
                        winston.debug("Response body: " + JSON.stringify(response) );
                    }
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
     * Done
     */
    proxySocket.on("close", function (had_error) {
        winston.info('User disconnected');
        vmSocket.end();
        proxySocket.destroy();

        // the user terminated the connection, that counts as an action - update the session info accordingly
        updateSession();
        saveSession();
        // stop the interval for session management
        stopInterval();
    });

    /**
     * On Error shut it down
     */
    proxySocket.on("error", function (err) {
        proxySocket.end();
        vmSocket.end();
    });

    /**
     * On VM Socket close - close Client connection
     */
    vmSocket.on('close', function () {
        proto.sendResponse({"type": "ERROR", "message": "VM closed the connection"}, proxySocket);
        proxySocket.end();
    });

    vmSocket.on('timeout', function () {
        vmSocket.end();
    });

    /**
     * Close connection on VM error
     */
    vmSocket.on("error", function (err) {
        // On error connecting to VM the state doesn't change
        var error = "VM Error: " + err;
        proto.sendResponse({"type": "ERROR", "message": error}, proxySocket);
    });

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
                    // remove the expired session from the database
                    if (session != null)
                        session.remove();
                    session = null;
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

    function stopInterval() {
        if (sessionInterval != null)
            clearInterval(sessionInterval);
    }
};

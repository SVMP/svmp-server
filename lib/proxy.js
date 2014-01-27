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
    config = require('../config/config').settings,
    webrtc = require('../config/config').webrtc,
    winston = require('winston');
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
    return { iceServers: ice, pcConstraints: pc, videoConstraints: video};
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

    proxySocket.on('data', function (data) {
        switch (state) {
        case UNAUTHENTICATED:
            try {
                var authObj = proto.parseAuthentication(data);

                if( authObj.testing === 'true') {
                    testing = true;
                }

                authenticator.authenticate(authObj).then(
                    function(obj) {
                        winston.info('User: \'%s\' authenticated', obj.username);
                        proto.sendResponse({type: 'AUTH', authResponse: {type: "AUTH_OK", sessionToken: obj.sid}}, proxySocket);

                        if(testing) {
                            proto.sendResponse({type: 'VMREADY', message: 'Testing. Not connected to VM'}, proxySocket);
                            state = VMREADY_SENT;
                        } else if( obj.vm && obj.vm.length > 0) {
                            // Connect to VM
                            vmSocket.connect(config.vm_port, obj.vm, function () {
                                winston.info('User: \'%s\' connected to VM: %s', obj.username, obj.vm);

                                // send json VIDEO_INFO
                                proto.sendRequest({"type": "VIDEO_PARAMS", "videoInfo": videoResponseObj}, vmSocket);
                                state = VMREADY_WAIT;
                                
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
                 var request = proto.readRequest(data);
                 if( request.type === 'VIDEO_PARAMS') {
                    // send json VIDEO_INFO
                    proto.sendResponse({"type": "VIDSTREAMINFO", "videoInfo": videoResponseObj}, proxySocket);
                    state = PROXYREADY;
                 }
            } catch (e) {
                proto.sendResponse({"type": "ERROR", "message": "Parser: Bad formed message"}, proxySocket);    
            }
            break;
        case PROXYREADY:
            /**
             * Proxy data straight through
             */
            vmSocket.write(data);
            break;
        }
    });

    /**
     * Send data to client
     */
    vmSocket.on('data', function (data) {
        if( state === VMREADY_WAIT) {
            var response = proto.readResponse(data);
            if (response.type === 'VMREADY') {
                state = VMREADY_SENT;
            }
        }
        proxySocket.write(data);
    });

    /**
     * Done
     */
    proxySocket.on("close", function (had_error) {
        winston.info('User disconnected');
        vmSocket.end();
        proxySocket.destroy();
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
};

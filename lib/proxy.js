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
    //mongoose = require('mongoose'),
    //User = mongoose.model('User'),
    config = require('../config/config'),
    request = require('request');

/**
 * States used by proxy
 */
var UNAUTHENTICATED = 1;
var VMREADY = 2;
var PROXYREADY = 3;


/**
 * Authenticate User against DB
 * @param {String} username
 * @param {String} password
 * @param {Function} callback
 */
/*function authenticate(username, password, callback) {
    User.findOne({ username: username }, function (err, user) {
        if (err) callback(err, undefined);
        if (user && user.authenticate(password)) {
            callback(undefined, user);
        } else {
            callback("Bad Username or Password", undefined);
        }
    });
}*/

function authenticate(credentials, callback) {
    // Make http request to Admin Server to validate 
    request.post(cred, function (err, resp, body) {
        if( !err && resp.statusCode === 200 ) {
            var obj = JSON.parse(body);
            console.log("Got: ", obj);
            callback(undefined,obj);
        } else {
            console.log("Error: ", err);
            callback(err);    
        }
    });
}

/**
 *  Generate videoinfo message from config 
 */ 
function videoResponse() {
    // Stringify parameters
    var ice = JSON.stringify(config.webrtc.ice);
    var video = JSON.stringify(config.webrtc.video);
    var pc = JSON.stringify(config.webrtc.pc);
    return { iceServers: ice, pcConstraints: pc, videoConstraints: video};
}



/**
 * Represents a connection from a client
 * @param {Socket} proxySocket
 */
exports.proxyConnection = function proxyConnection(proxySocket) {
    var vmSocket = new net.Socket(),
        
        // initial state
        state = UNAUTHENTICATED,
        videoResponseObj = videoResponse();

    proxySocket.on('data', function (data) {
        switch (state) {
        case UNAUTHENTICATED:
            /**
             * Parse request
             * Authenticate user
             * Connect to VM
             * Hopefully change state to VMREADY
             */
            try {
                var request = proto.readRequest(data),
                    username = request.authentication.un,
                    password = request.authentication.pw;
                    secureid = request.authenticate.secureid;
                
                    var cred = {url: config.settings.auth_server, 
                                form: {apikey: config.settings.apikey, 
                                       userid: username, 
                                       password: password, 
                                       secureid: secureid}};
                
                authenticate(cred, function (err, vm) {
                    if (vm) {
                        proto.writeResponse({"type": "AUTHOK", "message": ""}, proxySocket);
                        
                        /**
                         * Failed connection will be caught in vmSocket.on('error')
                         */
                        /*vmSocket.connect(config.vm_port, vm.ip, function () {
                            state = VMREADY;
                            proto.writeResponse({"type": "VMREADY", "message": ""}, proxySocket);
                        });*/

                    } else {
                        proto.writeResponse({"type": "ERROR", "message": err}, proxySocket);
                    }
                });
            } catch (e) {
                console.log("Actual Error: ", e);
                proto.writeResponse({"type": "ERROR", "message": "Parser: Bad formed message"}, proxySocket);
            }
            break;
        case VMREADY:
            /**
             * Parse request
             * Send Video Information
             * Change state to PROXYREADY
             */
            try {
                 var request = proto.readRequest(data);
                 if( request.type === 'VIDEO_PARAMS') {
                    // send json VIDEO_INFO
                    proto.writeResponse({"type": "VIDSTREAMINFO", "videoInfo": videoResponseObj}, proxySocket);
                    state = PROXYREADY;
                 }
            } catch (e) {
                console.log("Actual Error: ", e);
                 proto.writeResponse({"type": "ERROR", "message": "Parser: Bad formed message"}, proxySocket);    
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
        proxySocket.write(data);
    });

    /**
     * Done
     */
    proxySocket.on("close", function (had_error) {
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
        proto.writeResponse({"type": "ERROR", "message": "VM closed the connection"}, proxySocket);
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
        console.log("Error connecting to VM: ",err);
        var error = "VM Error: " + err;
        proto.writeResponse({"type": "ERROR", "message": error}, proxySocket);
    });
};
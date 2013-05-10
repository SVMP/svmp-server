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

var net = require('net');
var proto = require('./protocol');
var auth = require('./authentication');

var UNAUTHENTICATED = 1;
var AUTHENTICATED = 2;

/**
 * Represents a connection from a client
 * @param proxySocket
 */
exports.proxyConnection = function proxyConnection(proxySocket) {
    var vmSocket = new net.Socket();
    var state = UNAUTHENTICATED;

    proxySocket.on('data', function (data) {
        switch (state) {
            case UNAUTHENTICATED:
                var request = proto.readRequest(data);
                auth.authenticate(request, function (err, user) {
                    if (err) {
                        proto.writeResponse({"type": "ERROR", "message": err}, proxySocket);
                    } else {
                        state = AUTHENTICATED;
                        proto.writeResponse({"type": "AUTHOK", "message": ""}, proxySocket);
                        vmSocket.connect(user.vm.port, user.vm.ip, function () {
                            // connection made
                            proto.writeResponse({"type": "VMREADY", "message": ""}, proxySocket);
                        });
                    }
                });
                break;
            case AUTHENTICATED:
                vmSocket.write(data);
                break;
        }
    });

    /**
     * Fini
     */
    proxySocket.on("close", function (had_error) {
        vmSocket.end();
    });

    /**
     * On Error shut it down
     */
    proxySocket.on("error", function (err) {
        proxySocket.end();
        vmSocket.end();
    });

    /**
     * Proxy data through to VM
     */
    vmSocket.on('data', function (data) {
        proxySocket.write(data);
    });

    /**
     * On VM Socket close - close Client connection
     */
    vmSocket.on('close', function (data) {
        proto.writeResponse({"type": "ERROR", "message": "VM Stopped or Unavailable"}, proxySocket);
        proxySocket.end();
    });

    /**
     * Close connection on VM error
     */
    vmSocket.on("error", function (err) {
        vmSocket.end();
        proto.writeResponse({"type": "ERROR", "message": "VM Stopped or Unavailable"}, proxySocket);
        proxySocket.end();
    });
};
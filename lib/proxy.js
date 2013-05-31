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
var VMREADY = 2;

/**
 * Represents a connection from a client
 * @param proxySocket
 */
exports.proxyConnection = function proxyConnection(proxySocket) {
    var vmSocket = new net.Socket(),
        state = UNAUTHENTICATED;

    proxySocket.on('data', function (data) {
        switch (state) {
        case UNAUTHENTICATED:
            try {
                var request = proto.readRequest(data);
                auth.authenticate(request, function (err, user) {
                    if (err) {
                        proto.writeResponse({"type": "ERROR", "message": err}, proxySocket);
                    } else {
                        proto.writeResponse({"type": "AUTHOK", "message": ""}, proxySocket);

                        // Future: Call to openstack here

                        vmSocket.connect(user.vm.port, user.vm.ip, function () {
                            // connection made - ready to proxy to VM
                            state = VMREADY;
                            proto.writeResponse({"type": "VMREADY", "message": ""}, proxySocket);
                        });
                    }
                });
            } catch (e) {
                proto.writeResponse({"type": "ERROR", "message": "Parser: Bad formed message"}, proxySocket);
            }
            break;
        case VMREADY:
            // Proxy socket
            vmSocket.write(data);
            break;
        }
    });

    /**
     * Proxy data through to VM
     */
    vmSocket.on('data', function (data) {
        proxySocket.write(data);
    });

    /**
     * Fini
     */
    proxySocket.on("close", function (had_error) {
        console.log("Close client");
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
        //proxySocket.end();
        //vmSocket.destroy();
        proto.writeResponse({"type": "ERROR", "message": "VM Error: closing the connection"}, proxySocket);
        proxySocket.end();
    });

    vmSocket.on('timeout', function () {
        //proxySocket.end();
        vmSocket.end();
    });

    /**
     * Close connection on VM error
     */
    vmSocket.on("error", function (err) {
        //proxySocket.end();
        //vmSocket.end();
        //proto.writeResponse({"type": "ERROR", "message": "VM encountered an Error"}, proxySocket);
    });
};
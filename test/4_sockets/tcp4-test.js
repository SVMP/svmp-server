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
var
    svmp = require('../../lib/svmp'),
    framedSocket = require('../../lib/server/framedsocket'),
    net = require('net'),
    assert = require('assert');

PORT = 8001;
describe("Test TCP4 Server/Socket", function () {
    var instance;

    beforeEach(function (done) {

        // Change the settings at runtime
        svmp.config.set('settings:tls_proxy', false);

        instance = framedSocket.createServer(undefined, function (sock) {
            sock.on('message', function (msg) {
                var r = svmp.protocol.parseRequest(msg);

                assert.strictEqual(r.authRequest.username, 'dave');

                sock.write(svmp.protocol.writeResponse({
                    type: 'VMREADY',
                    message: "test1"
                }));
            });

        }).listen(PORT);

        instance.on('listening', function () {
            done();
        });
    });

    afterEach(function (done) {
        instance.close();
        done();
    });


    it('should process svmpsockets', function (done) {

        /** Setup up client to talk to server */
        var client = framedSocket.wrap(new net.Socket());

        client.on('message', function (msg) {
            var r = svmp.protocol.parseResponse(msg);
            assert.strictEqual(r.message, 'test1');
            done();
        });

        client.on('connect', function () {
            client.write(svmp.protocol.writeRequest({
                type: 'AUTH',
                authRequest: {
                    type: 'AUTHENTICATION',
                    username: 'dave'
                }
            }));
        });

        client.connect(PORT);
    });

});
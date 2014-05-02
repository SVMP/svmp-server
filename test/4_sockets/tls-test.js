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
    svmpSocket = require('../../lib/server/svmpsocket'),
    assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    tls = require('tls');

PORT = 8002;

describe("Test TLS Server/Socket", function () {
    var instance;

    before(function (done) {

        // Change the settings at runtime
        svmp.config.set('settings:tls_proxy', true);
        // No client authentication for this test
        svmp.config.set('settings:use_tls_user_auth', false);

        instance = svmpSocket.createServer(undefined, function (sock) {


            sock.on('message', function (msg) {
                var r = svmp.protocol.parseRequest(msg);

                assert.strictEqual(r.authRequest.username, 'dave');

                sock.sendResponse({
                    type: 'VMREADY',
                    message: "test1"
                });
            });

        }).listen(PORT);


        instance.on('listening', function () {
            done();
        });


    });

    after(function (done) {
        instance.close();
        done();
    });


    it('should process svmpsockets', function (done) {
        var keyFile = svmp.config.get('settings:tls_private_key');
        var certFile = svmp.config.get('settings:tls_certificate');
        var caFile = svmp.config.get('settings:tls_ca_cert');

        /** Setup up client to talk to server */
        var options = {};
        options.type = 'tls';
        options.key = fs.readFileSync(keyFile);
        options.cert = fs.readFileSync(certFile);
        options.ca = fs.readFileSync(caFile);
        options.passphrase = svmp.config.get('settings:tls_private_key_pass');
        options.rejectUnauthorized = false;

        var client = new svmpSocket.SvmpSocket(undefined, options);
        client.on('start', function (msg) {
            client.sendRequest({type: 'AUTH',
                authRequest: {
                    type: 'AUTHENTICATION',
                    username: 'dave'
                }});

        });
        client.on('message', function (msg) {
            var r = svmp.protocol.parseResponse(msg);
            assert.strictEqual(r.message, 'test1');
            done();
        });

        client.connect(PORT);
    });

});
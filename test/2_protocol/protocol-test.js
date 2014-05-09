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
 * author Dave Bryson
 *
 */

var
    svmp = require('../../lib/svmp'),
    assert = require('assert');


describe('Protocol Test', function () {

    it('should read/write request', function () {
        var obj1 = {
            type: 'AUTH',
            authRequest: {
                type: 'AUTHENTICATION',
                username: 'dave'
            }
        };

        var result = svmp.protocol.parseRequest(svmp.protocol.writeRequest(obj1));
        assert.strictEqual(result.authRequest.username, 'dave');
        assert.equal(result.type, 'AUTH');
    });

    it('should read/write response', function () {

        var obj1 = {
            type: 'VMREADY',
            message: "test1"
        };

        var result = svmp.protocol.parseResponse(svmp.protocol.writeResponse(obj1));
        assert.strictEqual(result.message, 'test1');
        assert.equal(result.type, 'VMREADY');
    });

});


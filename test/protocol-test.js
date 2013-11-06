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
var assert = require("assert");
var protocol = require('../lib/protocol');

// Test the protocol parser


describe('Protocol Code', function(){
    it('should write/read authentication request', function (){
        var message = { 
            type: "AUTH",
            authRequest: {
                type: "SESSION_TOKEN",
                username: "dave",
                sessionToken: "1a2b3c"
                // leave out password on purpose
                // leave out security token on purpose
            }
        };
        var req = protocol.readRequest( protocol.writeRequest(message) );
        assert.strictEqual(req.type, "AUTH");
        assert.strictEqual(req.authRequest.type, "SESSION_TOKEN");
        assert.strictEqual(req.authRequest.username, "dave");
        assert.strictEqual(req.authRequest.sessionToken, "1a2b3c");
        assert.strictEqual(req.authRequest.password, undefined); // left out password on purpose
        assert.strictEqual(req.authRequest.securityToken, undefined); // left out security token on purpose
    });

    it('should parse an authentication message to an object', function () {
        var message = { 
            type: "AUTH",
            authRequest: {
                type: "AUTHENTICATION",
                username: "dave",
                // leave out session token on purpose
                password: "pass",
                securityToken: "1234"
            }
        };
        var obj = protocol.parseAuthentication( protocol.writeRequest(message) );
        assert.strictEqual(obj.type, "AUTHENTICATION");
        assert.strictEqual(obj.username, "dave");
        assert.strictEqual(obj.sessionToken, undefined); // left out session token on purpose
        assert.strictEqual(obj.password, "pass");
        assert.strictEqual(obj.securityToken, "1234");
    });

    it('should error if not authentication message', function () {
        var message = { 
            type: "SCREENINFO"};
        assert.throws(
            function () {
                protocol.parseAuthentication( protocol.writeRequest(message) )
            },
            Error
        );
    });

    it('should write/read AUTHOK Response', function () {
        var message = {
            type: 'AUTH',
            authResponse: {
				type: 'AUTH_OK'
			}
        };

        var resp = protocol.readResponse( protocol.writeResponse(message) );
        assert.strictEqual(resp.type, "AUTH");
        assert.strictEqual(resp.authResponse.type, "AUTH_OK");

    });

    it('should handle error messages', function () {
        var message = { 
            type: "ERROR",
            message: 'badcode' 
        };
        var resp = protocol.readResponse( protocol.writeResponse(message) );
        assert.strictEqual(resp.type, "ERROR");
        assert.strictEqual(resp.message, "badcode");    
    });

    it('should handle vidstreaminfo messages', function () {
        var message = {
            type: 'VIDSTREAMINFO',
            videoInfo: {iceServers: 'a', pcConstraints: 'b', videoConstraints: 'c'}
        };
        var resp = protocol.readResponse( protocol.writeResponse(message) );
        assert.strictEqual(resp.type, 'VIDSTREAMINFO');
        assert.strictEqual(resp.videoInfo.iceServers, 'a');
        assert.strictEqual(resp.videoInfo.pcConstraints, 'b');
        assert.strictEqual(resp.videoInfo.videoConstraints, 'c');
    });
    
});

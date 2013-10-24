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
            type: "USERAUTH", 
            authentication: {username: "dave", entries: [{key:'a', value:'b'}]},
        };
        var req = protocol.readRequest( protocol.writeRequest(message) );
        assert.strictEqual(req.type, "USERAUTH");
        assert.strictEqual(req.authentication.username, "dave");
        assert.strictEqual(req.authentication.entries[0].key, "a");
    });

    it('should parse an authentication message to an object', function () {
        var message = { 
            type: "USERAUTH", 
            authentication: {username: "dave", entries: [{'key':'a', 'value':'b'},{'key':'c', 'value':'d'}]},
        };
        var obj = protocol.parseAuthentication( protocol.writeRequest(message) );
        assert.strictEqual(obj.username, "dave");
        assert.strictEqual(obj.a, "b");
        assert.strictEqual(obj.c, "d");   
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
            type: 'AUTHOK',
            message: '12345'
        };

        var resp = protocol.readResponse( protocol.writeResponse(message) );
        assert.strictEqual(resp.type, "AUTHOK");
        assert.strictEqual(resp.message, "12345");

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
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
var Schema = require('protobuf').Schema;
var readFile = require('fs').readFileSync;
var winston = require('winston');
var schema = new Schema(readFile(__dirname + '/../protocol/svmp.desc'));
var Request = schema['svmp.Request'];
var Response = schema['svmp.Response'];

/**
 * This code is to send/receive protobuf packets to Java clients.
 * It emulates the write/readDelimited() calls found only in the Java version of protobufs.
 * It basically adds a length header using varint to the packet.
 */


/**
 * Read protobuf varint
 * @param data
 * @returns {number}
 */
function readVarInt(data) {
    var result = 0;
    var offset = 0;
    var pos = 0;
    for (; offset < 32; offset += 7) {
        var b = data[pos];
        if (b == -1) {
            throw new Error("Malformed varint");
        }
        result |= (b & 0x7f) << offset;
        if ((b & 0x80) == 0) {
            return result;
        }
        pos++;
    }
    // Keep reading up to 64 bits.
    for (; offset < 64; offset += 7) {
        b = data[pos];
        if (b == -1) {
            throw new Error("Truncated message");
        }
        if ((b & 0x80) == 0) {
            return result;
        }
        pos++;
    }
}

/**
 * Write value as varint to Buffer
 * @param value
 * @returns {Buffer}
 */
function writeVarInt(value) {
    var buf = [];
    while (true) {
        if ((value & ~0x7F) === 0) {
            buf.push(value);
            return new Buffer(buf);
        } else {
            buf.push((value & 0x7F) | 0x80);
            value >>>= 7;
        }
    }
}

/**
 * Read payload minus length header
 * @param buffer
 * @returns {Array|string|Blob}
 */
function getPayload(buffer) {
    var len = buffer.length;
    var s = readVarInt(buffer);
    return buffer.slice((len - s), len);
}

/**
 * Write the Request to a Buffer adding a header with the length of the payload
 * @param message {Object}
 * returns {Buffer}
 */
exports.writeRequest = function(message) {
    var serialized = Request.serialize(message);
    var header = writeVarInt(serialized.length);
    return Buffer.concat([header,serialized]);    
};

/**
 * Read protobuf request
 * @param buffer
 * @returns {*|number}
 */
exports.readRequest = function (buffer) {
    var buf2 = getPayload(buffer);
    return Request.parse(buf2);
};

/**
 * Write the Response to a Buffer adding a header with the length of the payload
 * @param message {Object}
 * returns {Buffer}
 */
exports.writeResponse = function(message) {
    winston.debug("Sending response to client: " + message.type);
    var serialized = Response.serialize(message);
    var header = writeVarInt(serialized.length);
    return Buffer.concat([header,serialized]);
};

/**
 * Read protobuf response
 * @param buffer
 * @returns {*|number}
 */
exports.readResponse = function (buffer) {
    var buf2 = getPayload(buffer);
    return Response.parse(buf2);
};

/**
 * Send a request message over a socket
 * @param message {Object}
 * @param socket {Socket} to write to
 */
exports.sendRequest = function (message, socket) {
    var request = this.writeRequest(message);
    socket.write(request);
};

/**
 * Send a response message over a socket
 * @param message {Object}
 * @param socket {Socket} to write to
 */
exports.sendResponse = function(message, socket) {
    var response = this.writeResponse(message);
    socket.write(response);
};

exports.parseAuthentication = function(message) {
    var auth = this.readRequest(message);
    if( auth.type !== 'AUTH') {
        throw new Error('Not an authentication message type');
    }
    
    var result = {};
    // required attributes
    result.type = auth.authRequest.type; // either 'SESSION_TOKEN' or 'AUTHENTICATION'
    result.username = auth.authRequest.username;
    // optional attributes
	result.sessionToken = auth.authRequest.sessionToken;
	result.password = auth.authRequest.password;
	result.securityToken = auth.authRequest.securityToken;

    return result;
};







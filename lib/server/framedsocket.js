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
 *
 * Wrap a socket to frame messages
 *
 *
 * @author Dave Bryson
 *
 */
var
    svmp = require('./../svmp'),
    net = require('net'),
    tls = require('tls'),
    MAX_VARINT32_BYTES = 5;

/**
 * Helper to read Varint header.  Based on code from ByteBuffer.
 * @param buffer
 * @returns {{value: number, length: number}}
 */
function readVarIntHeader(buffer) {
    var count = 0, b,
        src = buffer;
    var value = 0 >>> 0;
    do {
        b = src.readUInt8(count);
        if (count < MAX_VARINT32_BYTES) {
            value |= ((b&0x7F)<<(7*count)) >>> 0;
        }
        ++count;
    } while (b & 0x80);
    value = value | 0; // Make sure to discard the higher order bits
    return {
        "value": value,
        "length": count
    };
}

/**
 * Wrap the onData event with the ability to buffer packets based on a protobuf (varint) delimited header.
 * @param socket
 * @returns {*}
 */
exports.wrap = function(socket) {
    var expectedSize = -1;
    var receivedSize = 0;
    var incomingPacket = [];

    var handleData = function (buff) {
        var recurse = false;

        // New packet. Read the header
        if (expectedSize < 0) {
            var m = readVarIntHeader(buff);
            expectedSize = m.value  + m.length;
        }
        var expectedRemaining = expectedSize - receivedSize;

        if (buff.length > expectedRemaining) {
            // More buffer than we need
            var newBuff = buff.slice(0, expectedRemaining);
            buff = buff.slice(expectedRemaining);

            recurse = true; // More to read

            incomingPacket.push(newBuff);
            receivedSize = expectedSize;
        } else {
            incomingPacket.push(buff);
            receivedSize += buff.length;
        }

        if (receivedSize == expectedSize) {

            // Forward the message as a new event
            socket.emit('message', Buffer.concat(incomingPacket));

            // Reset values
            expectedSize = -1;
            receivedSize = 0;
            incomingPacket = [];
        }

        if (recurse)
            handleData(buff);
    };

    socket.on('data', function(buff) {
        handleData(buff);
    });

    return socket;
};


/**
 * Helper to create a wrapped socket
 * @param options
 * @param connectionListener
 * @returns {*|request|*|*|request|*|Server}
 */
exports.createServer = function (options, connectionListener) {
    function onConnection(socket) {
        svmp.logger.info("New client connection from " + socket.remoteAddress);
        connectionListener(exports.wrap(socket));
    }

    options = options || {};
    return svmp.config.isEnabled('settings:tls_proxy')
        ? tls.createServer(svmp.config.get('tls_options'), onConnection)
        : net.createServer(options, onConnection);
};
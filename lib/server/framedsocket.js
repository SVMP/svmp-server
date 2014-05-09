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
            value |= ((b & 0x7F) << (7 * count)) >>> 0;
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
 * Wrap a socket with the ability to handle framing messages.  Packets are framed with a protobuf varint header.
 *
 * @param socket
 * @returns wrapped socket
 */
exports.wrap = function (socket) {
    var expectedSize = -1;
    var receivedSize = 0;
    var temp = new Buffer(0);

    var handleData = function (buff) {
        var recurse = false;

        // Buffer the input.  Note we calculate size to prevent internal for loop
        var bb = Buffer.concat([temp, buff], temp.length + buff.length);

        if (expectedSize < 0) {
            // Don't have a header yet
            try {
                // Try to read the header.  If we can't read, it'll throw an exception
                var m = readVarIntHeader(bb);
                expectedSize = m.value + m.length;
                // If we made it here, we have a header
            } catch (e) {
                // No bueno - Failed to read header. Accumulate the buffer and try again...
                temp = bb;
                return;
            }
        }

        // The accumulated buffer is the total data received
        receivedSize = bb.length;

        if (receivedSize > expectedSize) {
            // Read more than needed for this message, slice off the extra and recurse
            buff = bb.slice(expectedSize);

            recurse = true; // More to read
            receivedSize = expectedSize;
        }

        if (receivedSize === expectedSize) {
            // Got a complete message. Emit it
            socket.emit('message', bb.slice(0, expectedSize));

            // Done with this frame! Reset values
            expectedSize = -1;
            receivedSize = 0;
            temp = new Buffer(0);
        } else {
            // Need more input...accumulate
            temp = bb;
        }

        if (recurse) {
            handleData(buff);
        }
    };

    socket.on('data', function (buff) {
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
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
 * @author Dave Bryson
 *
 */

var
    net = require('net'),
    tls = require('tls'),
    util = require('util'),
    crypto = require('crypto'),
    EventEmitter = require('events').EventEmitter,
    ByteBuffer = require('bytebuffer'),
    svmp = require('./../svmp');

/**
 * Size of header in packet
 * @type {number}
 */
var HEADER_SIZE_BYTES = 1;

/**
 * Used on svmp sockets to assemble complete messages before attempting to parse with Protobuf. Assumes messages
 * are prefixed with a varint header containing the size of the message.  Used internally by SvmpSocket
 *
 * @param callback in the form function(packet).  Packet will be just header and message
 * @constructor
 */
function PacketReader(callback) {
    this.callback = callback;
    this.buffer = null;
    this.partial = null;
    this.read = 0;
    this.partialLength = 0;
    this.leftoverBuf = new Buffer(0);
}

/**
 * Read and process the incoming data. It buffers packets until we have a complete message.  Once
 * a complete message is received, readBuffer will run the callback with the message as an argument. Parsing the
 * actual Protobuf message is left to the using application.
 *
 * @param inbuffer from the socket on.data
 */
PacketReader.prototype.readBuffer = function (data) {
    // concat leftovers with new data
    var bb = ByteBuffer.wrap( Buffer.concat( [this.leftoverBuf, data] ) );

    // read messages until we run out of bytes and fail
    while ( bb.remaining() > 0 ) {
        try {
            bb.mark();
            var msgLen = bb.readVarint32();
            var msgBody = bb.slice(bb.offset, bb.offset+msgLen).toBuffer();
            // the callbacks expect a varint+body so cat that back on
            // FIXME: works, but wasteful
            var fullMsg = (new ByteBuffer(1 + msgLen)).writeVarint(msgLen).append(msgBody).flip();
            this.callback(fullMsg);
            bb.offset = bb.offset + msgLen;
        } catch (e) {
            // hit the end of the buffer without reading a full varints and message
            // save the leftovers, must include the parts of the initial parts of the varint
            bb.reset();
            this.leftoverBuf = bb.compact().toBuffer();
            break;
        }
    }
};

/**
 * SvmpSocket wraps a normal socket and hides the details of handling SVMP Protobuf messages.
 *
 * Based on the idea behind nssocket
 *
 * @param socket
 * @param options
 * @returns {SvmpSocket}
 * @constructor
 */
var SvmpSocket = exports.SvmpSocket = function (socket, options) {

    if (!(this instanceof SvmpSocket)) {
        return new SvmpSocket(socket, options);
    }

    options = options || {};

    if (!socket) {
        socket = createSocket(options);
    }

    this.socket = socket;
    this.connected = options.connected || socket.writable && socket.readable || false;

    this._type = options.type || 'tcp4';

    this._packetReader = null;

    EventEmitter.call(this);

    this._setup();
}

util.inherits(SvmpSocket, EventEmitter);

/**
 * Connect to endpoint
 * @returns {*}
 */
SvmpSocket.prototype.connect = function (/*port, host, callback*/) {
    var args = Array.prototype.slice.call(arguments),
        self = this,
        callback,
        host,
        port;

    args.forEach(function handle(arg) {
        var type = typeof arg;
        switch (type) {
            case 'number':
                port = arg;
                break;
            case 'string':
                host = arg;
                break;
            case 'function':
                callback = arg;
                break;
            default:
                self.emit('error', new Error('bad argument to connect'));
                break;
        }
    });

    host = host || '127.0.0.1';
    this.port = port || this.port;
    this.host = host || this.host;
    args = this.port ? [this.port, this.host] : [this.host];

    if (callback) {
        args.push(callback);
    }

    if (['tcp4', 'tls'].indexOf(this._type) === -1) {
        return this.emit('error', new Error('Unknown Socket Type'));
    }

    var errHandlers = self.listeners('error');

    if (errHandlers.length > 0) {
        self.socket._events.error = errHandlers[errHandlers.length - 1];
    }

    this.connected = true;
    this.socket.connect.apply(this.socket, args);
};

SvmpSocket.prototype._writer = function(msg) {
    if(this.socket.cleartext) {
        this.socket.cleartext.write(msg);
    } else {
        this.socket.write(msg);
    }
};

/**
 * Send an SVMP Request. It will convert the message to Protobuf format
 * @param object is the message in object format
 * @returns {*}
 */
SvmpSocket.prototype.sendRequest = function (object) {
    //var that = this;
    if (!this.socket || !this.connected) {
        return this.emit('error', new Error('SvmpSocket: socket is broken'));
    }

    try {
        var msg = svmp.protocol.writeRequest(object);
        this._writer(msg);
    } catch (e) {
        // Log it
        svmp.logger.error("Problem sending request: ", e.message);
    }
};

/**
 * Send an SVMP Response. It will convert the message to Protobuf format
 * @param object is the message in object format
 * @returns {*}
 */
SvmpSocket.prototype.sendResponse = function (object) {
    if (!this.socket || !this.connected) {
        return this.emit('error', new Error('SvmpSocket: socket is broken'));
    }

    try {
        var msg = svmp.protocol.writeResponse(object);
        this._writer(msg);
    } catch (e) {
        // Log it?
        svmp.logger.error("Problem sending response: ", e.message);
    }
};

/**
 * Send a raw message.  Used to send a message already in Protobuf format
 * @param data is a message already in protobuf format
 * @returns {*}
 */
SvmpSocket.prototype.sendRaw = function (data) {
    if (!this.socket || !this.connected) {
        return this.emit('error', new Error('SvmpSocket: socket is broken'));
    }
    this._writer(data);
};

/**
 * Destroy the socket.
 * @returns {*}
 */
SvmpSocket.prototype.destroy = function() {
    if (!this.socket) {
        return this.emit('error', new Error('SvmpSocket: socket is broken'));
    }

    try {
        this.socket.destroy();
    } catch (e) {
        svmp.logger.error("Error closing socket: " + e);
    }
}

SvmpSocket.prototype._setup = function () {
    var that = this;
    this._packetReader = new PacketReader(function (message) {
        that.emit('message', message);
    });

    var connectName;
    if (this._type === 'tcp4') {

        connectName = 'connect';
        this.socket.on('data', this._onData.bind(this));

    } else if (this._type === 'tls') {
        connectName = 'connect';

        if (this.connected) {
            this.socket.on('data', this._onData.bind(this));
        } else {
            this.socket.once('connect', function () {
                that.socket.cleartext.on('data', that._onData.bind(that));
            });
        }

    } else {
        this.emit('error', new Error('Bad Option Argument [socket type]'));
        return null;
    }

    if(this.socket.cleartext) {
        this.socket.cleartext.on(connectName, this._onStart.bind(this));
        this.socket.cleartext.on('close',   this._onClose.bind(this));
        this.socket.cleartext.on('error',   this._onError.bind(this));
    } else {
        this.socket.on(connectName, this._onStart.bind(this));
        this.socket.on('close',   this._onClose.bind(this));
        this.socket.on('error',   this._onError.bind(this));
    }


    if (this.socket.socket) {
        //
        // otherwise we get a error passed from net.js
        // they need to backport the fix from v5 to v4
        //
        this.socket.socket.on('error', this._onError.bind(this));
    }

};

SvmpSocket.prototype._onStart = function () {
    this.emit('start');
};

SvmpSocket.prototype._onData = function (fullmessage) {
    this._packetReader.readBuffer(fullmessage);
};

SvmpSocket.prototype._onError = function _onError(error) {
    this.connected = false;
    this.emit('error', error || new Error('An Unknown Error occured'));
};

SvmpSocket.prototype._onClose = function _onClose(hadError) {
    if (hadError) {
        this.emit('close', hadError, arguments[1]);
    }
    else {
        this.emit('close');
    }

    this.connected = false;
};

/*** Helpers ***/
function createSocket(options) {
    options = options || {};
    options.type = options.type || 'tcp4';

    return options.type === 'tls'
        ? createTlsSocket(options)
        : new net.Socket(options);
}

function createTlsSocket (options) {
    var self = this;

    //
    // Setup the TLS connection over the existing TCP connection:
    //
    // 1. Create a new instance of `net.Socket`.
    // 2. Create a new set of credentials with `options`.
    // 3. Create the TLS pair
    // 4. Pipe the TLS pair to the TCP socket
    //
    var socket = new net.Stream({ type: 'tcp4' });

    function setupTlsPipe () {

        var sslcontext = crypto.createCredentials(options),
            pair = tls.createSecurePair(sslcontext, false),
            cleartext = pipe(pair, socket);


        pair.on('secure', function() {
            var verifyError = pair.ssl.verifyError();

            if (verifyError) {
                cleartext.authorized = false;
                cleartext.authorizationError = verifyError;
            }
            else {
                cleartext.authorized = true;
            }
        });

        //
        // Setup the cleartext stream to have a `.connect()` method
        // which passes through to the underlying TCP socket.
        //
        socket.cleartext = cleartext;
        cleartext._controlReleased = true;
    }

    socket.on('connect', setupTlsPipe);

    return socket;
}


function pipe(pair, socket) {
    pair.encrypted.pipe(socket);
    socket.pipe(pair.encrypted);

    pair.fd = socket.fd;
    var cleartext = pair.cleartext;
    cleartext.socket = socket;
    cleartext.encrypted = pair.encrypted;
    cleartext.authorized = false;

    function onerror(e) {
        if (cleartext._controlReleased) {
            cleartext.emit('error', e);
        }
    }

    function onclose() {
        socket.removeListener('error', onerror);
        socket.removeListener('close', onclose);
        socket.removeListener('timeout', ontimeout);
    }

    function ontimeout() {
        cleartext.emit('timeout');
    }

    socket.on('error', onerror);
    socket.on('close', onclose);
    socket.on('timeout', ontimeout);

    return cleartext;
}


/**
 * Create an Svmp ProxyServer
 * @param settings
 * @param connectionListener
 * @returns {*|request|*}
 */
exports.createServer = function (options, connectionListener) {

    function onConnection(socket) {
        connectionListener(new SvmpSocket(socket));
    }

    var options = options || {};
    return svmp.config.isEnabled('settings:tls_proxy')
        ? tls.createServer(svmp.config.get('tls_options'), onConnection)
        : net.createServer(options, onConnection);
};


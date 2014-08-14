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
 *
 * Wrap a socket to frame messages
 *
 */

var
    svmp = require('./../svmp'),
    http = require('http'),
    https = require('https'),
    WebSocketServer = require('ws').Server;

exports.createServer = function (options, connectionListener) {
    function processRequest(req, res) {
        // websocket upgrade bypasses this
        // no other types of HTTP request are allowed, so send back a 403
        console.log('blah');
        res.statusCode = 403;
        res.end("Go away");
    }

    var app = null;
    options = options || {};

    if (svmp.config.isEnabled('settings:tls_proxy')) {
        app = https.createServer(svmp.config.get('tls_options'), processRequest );
    } else {
        app = http.createServer(processRequest);
    }

    var wss = new WebSocketServer({server: app});
    wss.on('connection', connectionListener);

    return app;
};

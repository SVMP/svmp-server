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
    svmp = require('../../lib/svmp'),
    framedSocket = require('../../lib/server/framedsocket');

svmp.init();

svmp.config.set('settings:tls_proxy', false);
svmp.config.set('settings:log_level', 'debug');
var port = svmp.config.get('settings:port');

framedSocket.createServer(undefined, function(sock) {

    sock.on('message', function (msg) {
        var r = svmp.protocol.parseRequest(msg);
        // Only send a response to valid messages
        if(r.type === 'WEBRTC' ) {
            sock.write(msg);
        }
    });

}).listen(port);

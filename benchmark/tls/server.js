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
    svmpSocket = require('../../lib/server/svmpsocket');

svmp.init();

svmp.config.set('settings:tls_proxy', true);
svmp.config.set('settings:use_tls_user_auth', false);

// Turning off logging increases through put by ~ 500 msg/s
svmp.config.set('settings:log_level', 'none');

var port = svmp.config.get('settings:port');

svmpSocket.createServer(undefined, function(sock) {

    sock.on('message', function (msg) {
        var r = svmp.protocol.parseRequest(msg);
        // Only send a response to valid messages
        if( r.authRequest.username === 'dave' ){
            sock.sendResponse({
                type: 'VMREADY',
                message: "test1"
            });
        }
    });


}).listen(port);
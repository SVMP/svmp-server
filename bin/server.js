#!/usr/bin/env node

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
 * @author Dave Bryson
 *
 */
var
    svmp = require(__dirname + '/../lib/svmp'),
    proxy = require(__dirname + '/../lib/server/proxy'),
    webSocket = require(__dirname + '/../lib/server/websocket');

svmp.init();

var port = svmp.config.get('port');
var with_tls = svmp.config.get('enable_ssl');

webSocket.createServer(undefined,proxy.handleConnection).listen(port);
svmp.logger.info('Listening on port %d', port);
if (with_tls) {
    svmp.logger.info('SSL enabled using cert %s', svmp.config.get('server_certificate'));
} else {
    svmp.logger.info('SSL disabled');
}

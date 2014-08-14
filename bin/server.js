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

var port = svmp.config.get('settings:port');
var with_tls = svmp.config.get('settings:tls_proxy');


/**
 * Runs an interval to terminate expired VMs (those that have been idle for too long)
 * This ensures that resources are freed up when users aren't using their VMs
 */
setInterval (
    function interval() {
        // TODO
        svmp.logger.debug("Running session expiration check");
        return;

        // Get an array of all sessions past their expiration time
        // svmp.session.getExpiredSessions().then(function (obj) {
        //     svmp.logger.debug("getExpiredSessions returned %d result(s)", obj.length);
        //     // loop through each session in the collection:
        //     for (var i = 0; i < obj.length; i++) {
        //         // remove the session
        //         // call the API server to tell it that the user logged off
        //     }
        // }, printErr );
    },
    svmp.config.get('settings:session_check_interval') * 1000
);

// helper function to pass to Q that prints messages from Error objects
function printErr(e) {
    svmp.logger.error(e.message);
}

webSocket.createServer(undefined,proxy.handleConnection).listen(port);
svmp.logger.info('Proxy running on port %d Using TLS? %s',port,with_tls);

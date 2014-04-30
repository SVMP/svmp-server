#!/usr/bin/env node

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
    svmp = require('../lib/svmp'),
    proxy = require('../lib/server/proxy'),
    svmpSocket = require('../lib/server/svmpsocket'),
    auth = require('../lib/authentication');

svmp.init();

var port = svmp.config.get('settings:port');
var with_tls = svmp.config.get('settings:tls_proxy');


/**
 * Runs an interval to terminate expired VMs (those that have been idle for too long)
 * This ensures that resources are freed up when users aren't using their VMs
 */
setInterval (
    function interval() {
        // Get an array of all sessions whose VMs are expired
        svmp.session.getExpiredVmSessions().then(function (obj) {
            svmp.logger.debug("getExpiredVmSessions returned %d result(s)", obj.length);
            // loop through each session in the collection:
            for (var i = 0; i < obj.length; i++) {
                // record the session information
                var sess = obj[i],
                    arg = {username : sess.username};

                // remove the session
                sess.remove(function(err, result) {
                    if (err)
                        svmp.logger.error("Couldn't remove session: " + err);
                    else
                        svmp.logger.verbose("Removed session '%s'", result.sid)
                });

                // obtain and remove the user's VM information, then destroy the VM
                svmp.users.findUser(arg)
                    .then(svmp.users.removeUserVM)
                    .then(svmp.openstack.destroyVM)
                    .catch(printErr);
            }
        }, printErr );
    },
        svmp.config.get('settings:vm_check_interval') * 1000
);

// helper function to pass to Q that prints messages from Error objects
function printErr(e) {
    svmp.logger.error(e.message);
}

function onConnection(socket) {
    var authenticator;

    if(svmp.config.useTlsCertAuth()) {
        var cert = socket.getPeerCertificate();
        authenticator = auth.Authentication.loadStrategy(cert);
    } else {
        authenticator = auth.Authentication.loadStrategy();
    }

    proxy.handleConnection(socket,authenticator);
}

svmpSocket.createServer(undefined,onConnection).listen(port);
svmp.logger.info('Proxy running on port %d Using TLS? %s',port,with_tls);

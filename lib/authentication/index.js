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
 * @author David Keppler
 *
 */

var
    Q = require('q'),
    jwt = require('jsonwebtoken'),
    svmp = require('../svmp');

/**
 * Called automatically by the proxy.
 * Assumes we will ALWAYS create and start a new VM for user and attach their storage. Storage should be
 * preset on user account creation
 *
 * @param requestObj parsed protobuf request
 * @returns {Promise|*} with a value object in the form {session: {Object}, user: {Object}}
 */
exports.authenticate = function(request) {
    // first, verify the JSON web token
    // we must use "ninvoke" to prevent the "verify" function from un-binding from its owner, "jwt"
    return Q.ninvoke(jwt, "verify", request.headers['x-access-token'], svmp.config.get('settings:token_secret'))
        // then, if we're using client certificate auth, verify that
        .then(function (tokenPayload) {
            if (svmp.config.useTlsCertAuth() && svmp.config.get('settings:reverse_proxied') ) {
                // pull cert info from the special HTTP headers the reverse proxy will add
                // TODO define the header to use and modify checkCert() accordingly
                if (! checkCert(request.headers['TODO ????'], tokenPayload)) {
                    throw new Error("User certificate did not match login token");
                }
            } else if (svmp.config.useTlsCertAuth()) {
                // pull the client cert from the underlying TLS socket
                var rawSocket = request.connection,
                    cert = rawSocket.getPeerCertificate();
                if (rawSocket.authorized) {
                    svmp.logger.verbose("Client presented certificate: " + JSON.stringify(cert, null, 2));
                    if (! checkCert(cert.subject, tokenPayload)) {
                        throw new Error("User certificate did not match login token");
                    }
                } else {
                    throw new Error("User certificate failed validation: " + rawSocket.authorizationError);
                }
            }
            // if we made it here without an error, return the token payload
            return tokenPayload;
        })
        // then, create a session object
        .then(svmp.vmSession.create);
        // omit rejection handler, send result or error to output promise
};

function checkCert(certInfo, token) {
    // verify the cert matches the subject of the token
    // TODO
    return false;
}

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
    var deferred = Q.defer();

    // pull the relevant data out of the request
    var authToken = request.headers['x-access-token'],
        rawSocket = request.connection;

    // check that the token is defined
    if (! authToken) {
        authFail("No login token found", "AUTH_FAIL", deferred);
        return deferred.promise;
    }

    // verify it's signature and expiration
    Q.nfCall(jwt.verify(authToken, 'TODO get jwt secret or issuer pub key and fill in XXX and YYY', {issuer: YYY}))
    .then(function(tokenPayload) {
        // token verified ok
        svmp.logger.debug("User presented session token '%s'", JSON.stringify(tokenPayload));

        // if using cert-based auth, ensure the user cert subject matches the token subject
        if ( svmp.config.get('settings:use_tls_user_auth') && svmp.config.get('settings:reverse_proxied') ) {
            // pull cert info from the special HTTP headers the reverse proxy will add
            // TODO define the header to use and modify checkCert() accordingly
            if (! checkCert(request.headers['TODO ????'], tokenPayload)) {
                authFail("User certificate did not match login token", "AUTH_FAIL", deferred);
            }
        } else if (svmp.config.useTlsCertAuth()) {
            // pull the client cert from the underlying TLS socket
            var cert = rawSocket.getPeerCertificate();
            if (rawSocket.authorized) {
                svmp.logger.verbose("Client presented certificate: " + JSON.stringify(cert, null, 2));
                if (! checkCert(cert.subject, tokenPayload)) {
                    authFail("User certificate did not match login token", "AUTH_FAIL", deferred);
                }
            } else {
                svmp.logger.error("User certificate failed validation: " + rawSocket.authorizationError);
                // TODO throw an error to the catch below
                authFail("User certificate failed validation", "AUTH_FAIL", deferred);
            }
        }

        // make a new session object in the local in-memory store
        svmp.session.create(tokenPayload)
        .then(function(sess){
            deferred.resolve(sess);
        }).done();
    }).catch(function(err) {
        // one of a variety of failures happened while verifying the token
        authFail(err, "AUTH_FAIL", deferred);
    }).done();

    return deferred.promise;
};

function authFail(err, response, deferred) {
    deferred.reject({message: err, responseType: response});
}

function checkCert(certInfo, token) {
    // verify the cert matches the subject of the token
    // TODO
    return false;
}

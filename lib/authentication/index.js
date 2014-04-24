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
    Q = require('q'),
    svmp = require('../svmp');

exports.Authentication = Authentication;

/**
 * Authentication Object
 * @params {Function} authentication function 
 * should be in the form function(obj, callback)
 */
function Authentication(name, strategy) {
    var callback = strategy || svmp.users.authenticateUser;
    if( typeof callback !== 'function' )
        throw new Error("Strategy must be a Function with a Node type callback");
    this.name = name || 'db';
    this.strategy = Q.denodeify(callback);
}

/**
 * Called automatically by the proxy.
 * Assumes we will ALWAYS create and start a new VM for user and attach their storage. Storage should be
 * preset on user account creation
 *
 * @param requestObj parsed protobuf request
 * @returns {Promise|*} with a value object in the form {session: {Object}, user: {Object}}
 */
Authentication.prototype.authenticate = function(parsedMessage) {

    // Convert to obj used by the other authentication chain
    if( parsedMessage.type !== 'AUTH') {
        throw new Error('Not an Authentication message');
    }

    // Convert to object used by the rest of the system
    var authRequest = parsedMessage.authRequest;

    var requestObj = {
        // Required
        type: authRequest.type,
        username: authRequest.username,
        // Optional
        sessionToken: authRequest.sessionToken,
        password: authRequest.password,
        securityToken: authRequest.securityToken
    };


    // the user sent a session token, try to authenticate it
    if (requestObj.sessionToken) {
        return svmp.session.checkForExpired(requestObj)
            .then(svmp.users.findUserWithSession);
    }

    // the user should have sent a password, try to authenticate it and create a new session
    return this.strategy(requestObj)
        .then(svmp.users.findUserWithSession)
        .then(svmp.session.create);
};


Authentication.loadStrategy = function (cert) {

    if(svmp.config.isEnabled('settings:use_pam')) {
        try {
            var plugin = require('./plugins/pam').authenticate;
            return new Authentication('pam',plugin);
        } catch (err) {
            svmp.logger.error("PAM authentication requested but could not load module. Exiting.");
            process.exit(1);
        }
    }

    if(cert) {
        var plugin = require('./plugins/tls').authenticate(cert);
        return new Authentication('tls',plugin);
    }

    return new Authentication();

};


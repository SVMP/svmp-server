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
    var deferred = Q.defer();

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
        securityToken: authRequest.securityToken,
        newPassword: authRequest.newPassword
    };

    if (requestObj.type === 0 && requestObj.sessionToken) { // type: SESSION_TOKEN
        // the user sent a session token, try to authenticate it
        svmp.logger.debug("User presented session token '%s'", requestObj.sessionToken);

        if (svmp.config.isEnabled('settings:use_tls_user_auth')) {
            // certificate authentication is enabled, make sure the certificate is valid before
            // checking the session token
            this.strategy(requestObj)
                .then(function (obj) {
                    // the certificate is valid; proceed to check the session token
                    requestObj.username = obj.username;
                    checkSessionToken(requestObj, deferred);
                }).catch(function (err) {
                    // the certificate is invalid
                    authFail(err, "AUTH_FAIL", deferred);
                }).done();
        } else {
            checkSessionToken(requestObj, deferred);
        }
    } else if (requestObj.type === 1) { // type: AUTHENTICATION
        // the user should have sent credentials, try to authenticate them and create a new session
        this.strategy(requestObj)
            .then(svmp.users.findUserWithSession)
            .then(function(obj) {
                if (!obj.user.password_change_needed) {
                    svmp.session.create(obj)
                        .then(function (obj) {
                            deferred.resolve(obj);
                        }).done();
                } else {
                    authFail("Password change required", "NEED_PASSWORD_CHANGE", deferred);
                }
            }).catch(function (err) {
                authFail(err, "AUTH_FAIL", deferred);
            }).done();
    } else if (requestObj.type === 2) { // type: PASSWORD_CHANGE
        // the user should have sent credentials, try to authenticate them, change password, and create a new session
        this.strategy(requestObj)
            .then(svmp.users.findUserWithSession)
            .then(svmp.users.changeUserPassword)
            .then(svmp.session.create)
            .then(function (obj) {
                deferred.resolve(obj);
            }).catch(function (err) {
                authFail(err, "PASSWORD_CHANGE_FAIL", deferred);
            }).done();
    }

    return deferred.promise;
};

function checkSessionToken(requestObj, deferred) {
    svmp.session.checkForExpired(requestObj)
        .then(svmp.users.findUserWithSession)
        .then(function (obj) {
            deferred.resolve(obj);
        }).catch(function (err) {
            deferred.reject(err);
        }).done();
}

function authFail(err, response, deferred) {
    deferred.reject({message: err, responseType: response});
}

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


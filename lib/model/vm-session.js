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
 * @author Joe Portner
 *
 */

var
    svmp = require('./../svmp'),
    http = require('q-io/http');

/**
 * Create a VM session for the User
 * @param {Object} in the form of a JSON Web Token Payload
 * @returns promise for {Object} in the form "{username: {String}, expireAt: {Date}}"
 */
exports.create = function (token) {
    //set up parameters for REST API call
    var body = {
        'username': token.sub,
        'expireAt': token.exp,
        'connectTime': new Date()
    };
    var params = svmp.config.getRestParams(token.iss + '/services/vm-session', 'POST', body);

    // return a promise to execute the REST API call
    return http.request(params)
    .then(function (response) {
        if (response.status != 200)
            throw new Error("session create failed, code: " + response.status);
        body.iss = token.iss; // keep track of the Overseer URL
        return body;
    });
};

/**
 * Updates the user's VM session activity date/time when they disconnect
 * @param {*}
 * @returns {*}
 */
exports.updateActivity = function (vmSession) {
    //set up parameters for REST API call
    var body = {
        'username': vmSession.username,
        'lastAction': new Date(),
        'connectTime': vmSession.connectTime
    };
    var params = svmp.config.getRestParams(vmSession.iss + '/services/vm-session', 'PUT', body);

    // return a promise to execute the REST API call
    return http.request(params)
    .then(function (response) {
        if (response.status != 200)
            throw new Error("session update failed, code: " + response.status);
    });
};

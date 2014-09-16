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
    Q = require('q');

/**
 * Create a VM session for the User
 * @param username of user
 * @param connectTime, Date the user opened this connection
 * @param expireAt, Date the VM Session expires
 * @returns promise
 */
exports.create = function (token) {
    var username = token.sub;
    var connectTime = new Date();
    var expireAt = token.exp;

    svmp.logger.verbose("Calling overseer: services/vm-session for user '%s'", username);

    // return a promise to execute the REST API call
    return Q.ninvoke(svmp.overseerClient, 'createVMSession', username, connectTime, expireAt)
        .then(function (res) {
            if (res.status !== 200)
                throw new Error("session create failed, response code: " + res.status + ", text: " + res.text);

            // if we get to this point without an error, we can return an object with the VM Session properties
            return {username: username, connectTime: connectTime, expireAt: expireAt};
        }, function (err) {
            // Overseer Client callback error message isn't descriptive enough, append this prefix message
            throw new Error("session create failed: " + err.message);
        });
        // no catch, pass errors to the parent
};

/**
 * Updates the user's VM session activity date/time when they disconnect
 * @param username of user
 * @param connectTime, Date the user opened this connection
 * @param lastAction, Date the user disconnected
 * @returns promise
 */
exports.updateActivity = function (username, connectTime) {
    var lastAction = new Date();

    svmp.logger.verbose("Calling overseer: services/vm-session for user '%s'", username);

    // return a promise to execute the REST API call
    return Q.ninvoke(svmp.overseerClient, 'updateVMSession', username, connectTime, lastAction)
        .then(function (res) {
            if (res.status !== 200)
                throw new Error("session update failed, response code: " + res.status + ", text: " + res.text);
        }, function (err) {
            // Overseer Client callback error message isn't descriptive enough, append this prefix message
            throw new Error("session update failed: " + err.message);
        });
        // no catch, pass errors to the parent
};

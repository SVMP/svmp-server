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
    svmp = require('./../svmp'),
    Q = require('q');

// Table of local sessions
var allSessions = Object.create(null);

// make a new session object in the local in-memory store
// keep all these in a global table indexed by user id so a global interval process can iterate through them easily
// return something
// session object should have at least these fields:
//   * connection id (so all log events related to this session can be easily grouped together by this id)
//       := the JWT "jti" field might do for this, and then they'd be globally unique at the API server level
//   * user id
//       := JWT subject field
//   * session expiry time (when the client gets kicked off the server)
//       := min(JWT expiration, max session length)
//   * VM IP/port

// Example:
// {
//     sessionid: "abcd-efgh-ijkl-mnop-qrst-uvwx-yz",
//     subject: "alice",
//     expires: timestamp,
//     vm: {
//         host: "10.1.2.3",
//         port: 8001
//     }
// }

/**
 * Create a session for the User
 * @param {Object} in the form of a JSON Web Token Payload
 * @returns {Object} in the form "{sessid: {String}, user: {String}, expires: {Date}, vm: {host: {String}, port: {int}}}"
 */
exports.create = function (token) {
    var max_session = svmp.config.get('settings:max_session_length') * 1000;

    // leave it promise-based for future flexibility
    var deferred = Q.defer();

    var now = new Date().getTime();
    var expires = new Date(Math.min(token.exp * 1000, now + max_session ));
    // TODO: fix this, 'expires' winds up being null

    // check if session already exists
    if ( token.sub in allSessions ) {
        // update the expiry time and return it
        allSessions[token.sub].expires = expires;
    } else {
        // create a new session with a null vm info field
        allSessions[token.sub] = {
            sessid:  token.jti,
            subject: token.sub,
            expires: expires
        };
    }
    deferred.resolve(allSessions[token.sub]);

    return deferred.promise;
};

exports.remove = function(subject) {
    var deferred = Q.defer();

    delete allSessions[subject];
    deferred.resolve();

    return deferred.promise;
};

/**
 * Checked for expiredSession.  Only used in Authentication.
 * @param {Object} requestObj request object from client
 * @returns {adapter.deferred.promise|*|promise|Q.promise}  promise value is {session: {Object}, user: {Object}}
 */
exports.checkForExpired = function (requestObj) {
    var deferred = Q.defer();
    var session_ttl = svmp.config.get('settings:session_token_ttl') * 1000;

    SessionModel.findOne({sid: requestObj.sessionToken}, function (err, sess) {
        if (sess) {
            var expired = sess.expireAt < new Date();
            var timedOut = (new Date(sess.lastAction.getTime() + (session_ttl)) < new Date());

            if (!expired && !timedOut) {
                // set the session 'lastAction' to 0, signifies the connection is active
                sess.lastAction = new Date(0);
                // save the session and return it
                sess.save(function (err, updated) {
                    if (updated)
                        deferred.resolve({session: updated, user: {username: updated.username}});
                    else
                        deferred.reject(new Error("Could not update session"));
                });
            }
            else {
                if (expired)
                    deferred.reject(new Error("Session is expired for user " + sess.username));
                else if (timedOut)
                    deferred.reject(new Error("Session is timed out for user " + sess.username));
            }
        }
        else
            deferred.reject(new Error("Session not found"));
    });
    return deferred.promise;
};

/**
* Get all sessions that have expired VMs (inactive sessions that have VMs that have been idle for too long)
* @returns Promise with an array of sessions
*/
exports.getExpiredSessions = function () {
    var deferred = Q.defer();


    SessionModel.find({
        'lastAction': {
            $lt: toDate(idle_ttl).seconds.ago,
            $gt: new Date(0) // the lastAction has to be > 0, otherwise the session is active
        }},
        function (err, sessions) {
            if (err)
                deferred.reject(new Error("getExpiredVmSessions failed: " + err));
            else
                deferred.resolve(sessions);
        }
    );
    return deferred.promise;
};

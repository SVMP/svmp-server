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
 * author Dave Bryson
 *
 */

'use strict';

var settings = global.config.settings,
    mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    crypto = require('crypto'),
    toDate = require('to-date'),
    Q = require('q');


// Size of the session id
var UID_SIZE = 64;

// Session state is used to determine the grace period when a user can reconnect without authenticating
// Session state is also used to keep track of VM idle time to determine if that is expired
// Because of this, sessions are ONLY removed when:
//   1. a VM expires (and is subsequently destroyed), or
//   2. a user re-authenticates to get a new session after an old session has expired and before the VM expires
var SessionSchema = new Schema({
    sid: {type: String, unique: true, required: true},
    username: {type: String, required: true},
    expireAt: {type: Date},
    // maintains session state; if this is 0 the session is active, otherwise this is the time the user disconnected
    lastAction: {type: Date}
});

// Setup Schema
var SessionModel = mongoose.model('sessionmodel', SessionSchema);


/**
 * Create a session for the user
 * @param obj in the form {session: {Object}, user: {Object}}
 * @returns {adapter.deferred.promise|*|promise|Q.promise}  promise value is {session: {Object}, user: {Object}}
 */
exports.create = function (obj) {
    var deferred = Q.defer();
    try {
        var token = crypto.randomBytes(UID_SIZE).toString('hex');
    } catch (err) {
        deferred.reject(new Error('Error creating the session'));
        return deferred.promise;
    }
    var s = new SessionModel({sid: token, username: obj.user.username,
            expireAt: toDate(settings.max_session_length).seconds.fromNow, lastAction: new Date(0)});
    s.save(function(err, sess){
        if(err) { 
            deferred.reject(new Error('Error creating the session'));
        } else {
            // before we return the result, remove any orphaned sessions that may exist that are tied to this username
            SessionModel.remove({ username: obj.user.username, sid: { $ne: sess.sid }}, function(err, result) {
                if (err) {
                    deferred.reject(new Error('Could not remove orphaned sessions: ' + err));
                } else {
                    //obj.session = sess;
                    deferred.resolve({session: sess, user: obj.user});
                }
            });
        }
    });
    return deferred.promise; 
};

// Used ONLY for testing...
exports.testSession = function(id, username, callback) {
    var s = new SessionModel({sid: id, username: username, expireAt: expireDate(), lastAction: new Date(0)});
    s.save(function(err, sess){
        if(err) { 
            callback('Error creating the session');
        } else {
            callback(sess.sid);
        }
    });
};

exports.clearSessions = function (callback) {
    SessionModel.remove({},callback);  
}

/**
 * Get a session.
 * @param {Object} requestObj request object from client
 * @returns {adapter.deferred.promise|*|promise|Q.promise}  promise value is {session: {Object}, user: {Object}}
 */
exports.get = function (requestObj) {
    var deferred = Q.defer();
    SessionModel.findOne({sid: requestObj.sessionToken}, function(err, sess) {
        if(sess) {
            var expired = sess.expireAt < new Date();
            var timedOut = (new Date(sess.lastAction.getTime() + (settings.session_token_ttl*1000)) < new Date());

            if (!expired && !timedOut) {
                // set the session 'lastAction' to 0, signifies the connection is active
                sess.lastAction = new Date(0);
                // save the session and return it
                sess.save(function(err, updated) {
                    if (updated)
                        deferred.resolve({session: updated, user: {username: updated.username}});
                    else
                        deferred.reject(new Error("Could not update session"));
                });
            }
            else {
                if (expired)
                    deferred.reject(new Error("Session is expired"));
                else if (timedOut)
                    deferred.reject(new Error("Session is timed out"));
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
exports.getExpiredVmSessions = function () {
    var deferred = Q.defer();
    SessionModel.find({
        'lastAction': {
            $lt: toDate(settings.vm_idle_ttl).seconds.ago,
            $gt: new Date(0) // the lastAction has to be > 0, otherwise the session is active
        }},
        function(err, sessions) {
            if (err)
                deferred.reject(new Error("getExpiredVmSessions failed: " + err));
            else
                deferred.resolve(sessions);
        }
    );
    return deferred.promise;
};

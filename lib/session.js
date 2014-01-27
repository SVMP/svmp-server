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
var config = require('../config/config').settings,
    mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    uidhelper = require('uid2'),
    Q = require('q');


// Size of the session id
var UID_SIZE = 32;

var SessionSchema = new Schema({
    sid: {type: String, unique: true, required: true},
    username: {type: String, required: true},
    // automatically deletes this document at specified time (note: requires mongodb 2.2 or newer)
    expireAt: {type: Date, expires: 0},
    // used for session renewal
    lastAction: {type: Date}
});

// Setup Schema
var SessionModel = mongoose.model('sessionmodel', SessionSchema);


/**
 * Create a new Session
 * @param {Obj} the request object: {username: '', vm; ''}
 * @returns a Promise adding a session token to the object
 */
exports.create = function (obj) {
    var deferred = Q.defer();
    var s = new SessionModel({sid: uidhelper(UID_SIZE), username: obj.username, expireAt: expireDate(), lastAction: new Date()});
    s.save(function(err, sess){
        if(err) { 
            deferred.reject(new Error('Error creating the session'));
        } else {
            obj.session = sess;
            deferred.resolve(obj);
        }
    });
    return deferred.promise; 
};

// Used ONLY for testing...
exports.testSession = function(id, username, callback) {
    var s = new SessionModel({sid: id, username: username, expireAt: expireDate(), lastAction: new Date()});
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
 * @param {Object} raw request object from client
 * @returns Promise with an Object {session, username}
 */
exports.get = function (requestObj) {
    var deferred = Q.defer();
    SessionModel.findOne({sid: requestObj.sessionToken}, function(err, sess) {
        if(sess) {
            var expired = sess.expireAt < new Date();
            var timedOut = (new Date(sess.lastAction.getTime() + (config.session_token_ttl*1000)) < new Date());

            if (!expired && !timedOut)
                deferred.resolve({session: sess, username: sess.username});
            else {
                if (expired)
                    deferred.reject(new Error("Session is expired"));
                else if (timedOut)
                    deferred.reject(new Error("Session is timed out"));
                sess.remove();
            }
        }
        else
            deferred.reject(new Error("Session not found"));
    });
    return deferred.promise; 
};

// returns the future Date that the new session will expire
expireDate = function() {
    return new Date(new Date().getTime() + (config.max_session_length*1000));
}


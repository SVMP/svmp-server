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


var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    Q = require('q');

// Schema for a user of the Proxy
var ProxyUserSchema = new Schema({
    username: {type: String, unique: true, index: true, required: true},
    password: String, // Optional
    vm_id: String,
    vm_ip: String,
    volume_id: String
});

// Setup Schema
var Model = mongoose.model('proxyusers', ProxyUserSchema);


exports.listUsers = function (callback) {
    Model.find({}, function (err, users) {
        if (users) {
            callback(undefined, users);
        } else {
            callback('Error listing Users');
        }
    });


};

exports.clearUsers = function (callback) {
    Model.remove({}, callback);
};


exports.findUserWithSession = function(obj) {
    var deferred = Q.defer();
    Model.findOne({username: obj.username}, function (err, user) {
        if (err) {
            deferred.reject(new Error('User not found'));
        } else {
            obj.user = user;
            deferred.resolve(obj);
        }
    });
    return deferred.promise;
};

exports.findUser = function (obj) {
    var deferred = Q.defer();
    Model.findOne({username: obj.username}, function (err, user) {
        if (err) {
            deferred.reject(new Error('User not found'));
        } else {
            deferred.resolve(user);
        }
    });
    return deferred.promise;
};

exports.updateUser = function (user) {
    var deferred = Q.defer();
    user.save(function (err, updateduser) {
            if (updateduser) {
                deferred.resolve(updateduser);
            } else {
                deferred.reject(new Error('Failed updating user: ' + user.username));
            }
        }
    );
    return deferred.promise;
};


exports.createUser = function (username, password, callback) {
    var user = new Model({username: username, password: password, vm_ip: '', vm_id: '', volume_id: ''});
    user.save(callback);
};

exports.authenticateUser = function (obj, callback) {
    var un = obj.username;
    var pw = obj.password;
    if (un && pw) {
        Model.findOne({username: un, password: pw}, function (err, user) {
            if (user) {
                callback(undefined, {username: user.username});
            } else {
                callback("Bad Username or Password");
            }
        });
    } else {
        callback("Missing Username or Password");
    }
}

/*
 * Finds a user and removes its vm information
 * @param {Obj} the request object: {username: ''}
 * @returns a Promise adding a vm_id to the request object
 */
exports.removeUserVM = function (obj) {
    var deferred = Q.defer();
    Model.findOne({username: obj.username}, function(err, user) {
        if(err)
            deferred.reject(new Error("removeUserVM failed, couldn't find user '" + obj.username + "': " + err));
        else {
            obj.vm_id = user.vm_id;
            user.vm_id = undefined;
            user.vm_ip = undefined;
            user.save( function(err, user, numberAffected) {
                if (err)
                    deferred.reject(new Error("removeUserVM failed, couldn't save user: " + err));
                else
                    deferred.resolve(obj);
            })
        }
    });
    return deferred.promise;
}

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
    svmp = require('../svmp');
    Schema = svmp.mongoose.Schema,
    Q = require('q');

// Schema for a user of the Proxy
var ProxyUserSchema = new Schema({
    username: {type: String, unique: true, index: true, required: true},
    password: String, // Optional
    vm_id: String,
    vm_ip: String,
    vm_ip_id: String, // OpenStack ID number of floating IP address (optional)
    volume_id: String,
    device_type: String
});

// Setup Schema
var Model = svmp.mongoose.model('proxyusers', ProxyUserSchema);


/**
 * List all Users
 * @param {Function} {function (err, result)}
 */
exports.listUsers = function (callback) {
    Model.find({}, function (err, users) {
        if (users) {
            callback(undefined, users);
        } else {
            callback('Error listing Users');
        }
    });


};

/**
 * Delete all users
 *
 * @param callback {function (err, result)}
 */
exports.clearUsers = function (callback) {
    Model.remove({}, callback);
};

/**
 * Used by Authenticate to pass extra object information
 * needed for setup.
 * @param obj
 * @returns {Promise}
 */
exports.findUserWithSession = function(obj) {
    var deferred = Q.defer();
    var un;
    if(obj.user) {
        un = obj.user.username;
    } else {
        un = obj.username;
        obj.session = undefined;
    }
    Model.findOne({username: un}, function (err, user) {
        if (err || user === null) {
            deferred.reject(new Error("User '" + un + "' not found"));
        } else {
            deferred.resolve({session: obj.session, user: user});
        }
    });
    return deferred.promise;
};

/**
 * Find a User by username
 * @param {Object} in the form {username: value}
 * @returns {Promise}
 */
exports.findUser = function (obj) {
    var deferred = Q.defer();
    Model.findOne({username: obj.username}, function (err, user) {
        if (err) {
            deferred.reject(new Error("User '" + obj.username + "' not found"));
        } else {
            deferred.resolve(user);
        }
    });
    return deferred.promise;
};

/**
 * Update a user
 * @param {Object} user
 * @returns {Promise}
 */
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

/**
 * Create a new User
 * @param username
 * @param password
 * @param device_type
 * @param callback {function (err, result)}
 */
exports.createUser = function (username, password, device_type, callback) {
    // note: vm_ip and vm_id MUST be undefined for the "setupuser" module to create a new VM when this user logs in
    var user = new Model({username: username, password: password, device_type: device_type, volume_id: ''});
    user.save(callback);
};

/**
 * Username/Password authentication
 * @param {Object} {username: value, password: value}
 * @param {Function} callback
 */
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
 * Removes a user's vm information
 * @param {obj} the user object
 * @returns {Promise} with an object {vm_id: value, vm_ip: value}
 */
exports.removeUserVM = function (user) {
    var deferred = Q.defer();

    if (!user.vm_id)
        deferred.reject(new Error("removeUserVM failed, user '" + user.username + "' has no vm_id defined (was this user's vm_ip manually assigned?)"));
    else {
        var obj = {vm_id: user.vm_id, vm_ip: user.vm_ip, vm_ip_id: user.vm_ip_id};
        user.vm_id = undefined;
        user.vm_ip = undefined;
        user.vm_ip_id = undefined;
        user.save( function(err, user, numberAffected) {
            if (err)
                deferred.reject(new Error("removeUserVM failed, couldn't save user: " + err));
            else
                deferred.resolve(obj);
        })
    }

    return deferred.promise;
};

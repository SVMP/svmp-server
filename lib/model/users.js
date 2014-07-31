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
    svmp = require('../svmp'),
    Model = require('svmp-user-model')(svmp.mongoose),
    Q = require('q');

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
exports.findUserWithSession = function (obj) {
    var deferred = Q.defer();
    var un;
    if (obj.user) {
        un = obj.user.username;
    } else {
        un = obj.username;
        obj.session = undefined;
    }
    Model.findOne({username: un}, function (err, user) {
        if (err || user === null) {
            deferred.reject(new Error("User '" + un + "' not found"));
        } else {
            deferred.resolve({session: obj.session, user: user, requestObj: obj.requestObj});
        }
    });
    return deferred.promise;
};

/**
 * Used by Authenticate to process a change password request.
 * @param obj
 * @returns {Promise}
 */
exports.changeUserPassword = function (obj) {
    var deferred = Q.defer();

    Model.findOne({username: obj.user.username}, function (err, user) {
        if (err) {
            deferred.reject(new Error("changeUserPassword failed, could not find user '" + obj.user.username + "': " + err));
        }
        // The default authenticate strategy does validate password before change.  We leave it here
        // for now so if code gets moved around we still covered - better safe than sorry...
        else if (user.authenticate(obj.requestObj.password)) {
            user.password = obj.requestObj.newPassword;
            user.password_change_needed = false;
            user.save(function (err1, r) {
                if (err1) {
                    // user model validation failed
                    deferred.reject(new Error("changeUserPassword failed, could not change password for user '" + obj.user.username + "': " + err1));
                } else {
                    deferred.resolve(obj);
                }
            });
        }
        else {
            // failed authentication, reject
            deferred.reject(new Error("changeUserPassword failed, user '" + obj.user.username + "' did not pass authentication"));
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
 * @param email
 * @param device_type
 * @param callback {function (err, result)}
 */
exports.createUser = function (username, password, email, device_type, callback) {
    // note: vm_ip and vm_id MUST be empty for the "setupuser" module to create a new VM when this user logs in
    var user = new Model({
        username: username,
        password: password,
        email: email,
        password_change_needed: true,
        device_type: device_type,
        volume_id: ''
    });
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
        Model.findOne({username: un}, function (err, user) {
            if (user && user.authenticate(pw)) {
                callback(undefined, {username: user.username, requestObj: obj});
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

    if (!user.vm_id || user.vm_id.length == 0)
        deferred.reject(new Error("removeUserVM failed, user '" + user.username + "' has no vm_id defined (was this user's vm_ip manually assigned?)"));
    else {
        var obj = {vm_id: user.vm_id, vm_ip: user.vm_ip, vm_ip_id: user.vm_ip_id};
        user.vm_id = "";
        user.vm_ip = "";
        user.vm_ip_id = "";
        user.save(function (err, user, numberAffected) {
            if (err)
                deferred.reject(new Error("removeUserVM failed, couldn't save user: " + err));
            else
                deferred.resolve(obj);
        })
    }

    return deferred.promise;
};

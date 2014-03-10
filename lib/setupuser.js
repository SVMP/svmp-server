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

var Openstack = require('./openstack'),
    users = require('./users'),
    settings = global.config.settings,
    Q = require('q');

/**
 * Used in authenticate to create/start VM and attach Storage
 *
 * @param userSessionObj
 * @returns {adapter.deferred.promise|*|promise|Q.promise} with a value object in the form {session: {Object}, user: {Object}}
 */
exports.onLogin = function(userSessionObj) {
    var deferred = Q.defer();
    var flvr = settings.new_vm_defaults.vmflavor;
    var user = userSessionObj.user;
    var img = settings.new_vm_defaults.images[user.device_type];

    Openstack.createAndStartVM(user,img,flvr)
        .then(users.updateUser)
        .then(Openstack.attachVolumeToVMForUser)
        .then(function (updatedUser) {
            deferred.resolve({session: userSessionObj.session, user: updatedUser});
        },function(err){
            deferred.reject(new Error("VM setup failed: ", err.message));
        });

    return deferred.promise;
};
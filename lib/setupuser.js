/**
 * Created by DBRYSON on 2/24/14.
 */
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
    settings = global.config.settings;

// Expects a use object from authentication
exports.onLogin = function(userSessionObj) {
    var img = settings.new_vm_defaults.goldimage;
    var flvr = settings.new_vm_defaults.vmflavor;
    var user = userSessionObj.user;
    return Openstack.createAndStartVM(user,img,flvr)
        .then(users.updateUser)
        .then(Openstack.attachVolumeToVMForUser);
};
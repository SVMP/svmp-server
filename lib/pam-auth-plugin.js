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
var pam = require('authenticate-pam'),
    settings = global.config.settings;

var pam_service = settings.pam_service;
var pam_host = 'localhost';

exports.pamAuthentication = function(obj, callback) {
    var un = obj.username,
        pw = obj.password;
    pam.authenticate(un, pw, function(err) {
        if(err) {
            callback("Error authenticating: ", err);
        }
        else {
            callback(undefined,{username: un})
        }
    }, {serviceName: pam_service, remoteHost: pam_host});
};

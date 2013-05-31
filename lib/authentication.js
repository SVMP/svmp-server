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

var users = require('../users/db');

/**
 * Simple authentication that uses in-memory db for testing/demos...
 * @param request Protobuf request object
 * @param callback
 * @returns {*}
 */
exports.authenticate = function (request, callback) {
    if (request === null || request.type !== 'USERAUTH') {
        return callback("Bad Request");
    }
    var user = users[request.authentication.un];
    if (user && user.pw === request.authentication.pw) {
        return callback(null, user);
    }
    return callback("Bad Username or Password");
};

/**
 * Use in routes to check authentication for admin server
 * @param req
 * @param res
 * @param next
 */
exports.requiresAdmin = function (req, res, next) {
    if (!req.user.admin) {
        console.log("USER: ", req.user.admin);
        req.flash('info', 'Login required with proper credentials');
        res.redirect('/login');
    } else {
        next();
    }
};

/**
 * Use in routes to check is User has Admin permission
 * @param req
 * @param res
 * @param next
 */
exports.requiresLogin = function (req, res, next) {
    if (!req.isAuthenticated()) {
        res.redirect('/login');
    } else {
        next();
    }
};

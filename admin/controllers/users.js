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
/**
 * CRUD Users API
 * @type {*}
 * @author Dave Bryson
 */
var mongoose = require('mongoose');
var User = mongoose.model('User');


exports.index = function (req, res) {
    res.render('index');
};

/**
 * show all users
 * @param req
 * @param res
 */
exports.list = function (req, res) {
    User.find({}, function (err, users) {
        if (err) {
            res.status(500).send({ error: "Error listing Users" });
        } else {
            //res.render('index', {users: users});
            res.send(users);
        }
    });
};

/**
 * Get a User be ID
 * @param req
 * @param res
 */
exports.show = function (req, res) {
    User.findById(req.params.id, function (err, user) {
        if (err) {
            res.status(500).send({ error: "Error finding User: " + req.params.id });
        } else {
            res.send(user);
        }
    });
};

/**
 * Add a new User. Failing on duplicates
 * @param req
 * @param res
 */
exports.add = function (req, res) {
    var user = new User(req.body);
    user.save(function (err, newuser) {
        if (err) {
            // 11000 is dup record
            if (err.code === 11000) {
                res.status(500).send({ error: 'User already exists'});
            } else {
                res.status(500).send({ error: 'Error adding the user'});
            }
        } else {
            res.send(200);
        }
    });
};

/**
 * Update a User for a given ID
 * @param req
 * @param res
 */
exports.update = function (req, res) {
    User.findById(req.params.id, function (err, user) {
        user.username = req.body.username;
        user.vminstance_ip = req.body.vminstance_ip;
        user.vminstance_port = req.body.vminstance_port;
        user.admin = req.body.admin;
        user.save();
        res.send(200);
    });
};

/**
 * Change an existing user's password
 * @param req
 * @param res
 */
exports.change_password = function (req, res) {
    User.findById(req.body_id, function (err, user) {
        if (user) {
            user.password = req.body.password;
            user.save();
            res.send(200);
        } else {
            res.status(500).send({ error: "Error finding User: " + req.body.username});
        }
    });
};

/**
 * Delete a User for a given ID
 * @param req
 * @param res
 */
exports.remove = function (req, res) {
    User.findById(req.params.id, function (err, user) {
        user.remove();
        res.send(200);
    });
};

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

var path = require('path');


function requiresAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.admin) {
        next();
    } else {
        req.flash('error', 'Login required with proper credentials');
        res.redirect('/login');
    }
}

/**
 * Application routes
 * @param app Express app
 */
module.exports = function (app, passport) {

    // Services
    var users = require('../admin/controllers/users'),
        home = require('../admin/controllers/home');

    app.get('/', requiresAdmin, function (req, res) {
        res.render('index');
    });

    // Login Form
    app.get('/login', home.login);
    // Logout
    app.get('/logout', function (req, res) {
        req.logOut();
        res.redirect('/login');
    });
    // Login in user and establish session
    app.post('/user/session', passport.authenticate('local', {failureRedirect: '/login', failureFlash: 'Invalid username or password.'}),
        function (req, res) {
            //res.redirect('/users');
            res.redirect('/');
        });


    // Users API

    // List Users
    app.get('/users', requiresAdmin, users.list);
    // Get User by ID
    app.get('/users/:id', requiresAdmin, users.show);
    // Add a new User
    app.post('/users', requiresAdmin, users.add);
    // Update User
    app.post('/users/:id', requiresAdmin, users.update);
    // Delete User
    app.delete('/users/:id', requiresAdmin, users.remove);

    app.post('/users/change', requiresAdmin, users.change_password);

    // Handle Errors
    app.use(function (err, req, res, next) {
        res.render('500');
    });

    app.use(function (req, res) {
        res.render('404', "Not Found");
    });

};
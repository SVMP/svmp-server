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
 * Configure Express
 */
var express = require('express');
var flash = require('connect-flash');

module.exports = function (app, config, passport) {

    app.set('showStackError', false);

    app.use(express.compress({
        filter: function (req, res) {
            return (/json|text|javascript|css/).test(res.getHeader('Content-Type'));
        },
        level: 9
    }));

    app.use(express.static(config.admin_root + '/admin/public'));

    // set views path, template engine and default layout
    app.set('views', config.admin_root + '/admin/views');
    app.set('view engine', 'jade');

    app.use(express.logger('dev'));

    app.configure(function () {
        app.use(express.cookieParser());

        // bodyParser should be above methodOverride
        app.use(express.bodyParser());

        app.use(express.methodOverride());

        // express session storage
        app.use(express.session({secret: '856b175ba8291bcafcd6a196443f91ab0e38f067'}));

        // connect flash for flash messages
        app.use(flash({ unsafe: true }));

        // use passport session
        app.use(passport.initialize());
        app.use(passport.session());

        // Sets authenticated flag for templates
        app.use(function (req, res, next) {
            res.locals.authenticated = req.isAuthenticated() && req.user.isAdmin();
            next();
        });

        app.use(express.favicon());

        // Setup Express router for use
        app.use(app.router);

    });
};
'use strict';

/**
 * Configure Express
 */
var express = require('express');
var flash = require('connect-flash');

module.exports = function (app, config, passport) {

    app.set('showStackError', true);

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

        // Handle Errors
        app.use(function (err, req, res, next) {
            // log it
            console.error(err.stack);
            // error page
            res.status(500).render('500', { error: err.stack });
        });

        // assume 404 since no middleware responded
        app.use(function (req, res) {
            res.status(404).render('404', "Not Found");
        });

    });
};
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


    // Home page
    app.get('/', function (req, res) {
        res.redirect('/users');
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
            res.redirect('/users');
        });


    // Users Controller
    app.get('/users', requiresAdmin, users.list);
    //app.get('/users/:id', requiresAdmin, users.show);
    app.get('/users/new', requiresAdmin, users.new);
    app.post('/users', requiresAdmin, users.add);
    //app.post('/users/:id', users.update);

    // THIS SHOULD BE A DELETE VERB!
    app.get('/users/delete/:id', requiresAdmin, users.remove);

};
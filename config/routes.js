'use strict';

var path = require('path');

/**
 * Application routes
 * @param app Express app
 */
module.exports = function (app, passport, auth) {

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
    app.post('/user/session', passport.authenticate('local', {failureRedirect: '/login'}),
        function (req, res) {
            res.redirect('/users');
        });


    // Users Controller
    app.get('/users', auth.requiresLogin, auth.requiresAdmin, users.list);
    //app.get('/users/:id', auth.requiresLogin, auth.requiresAdmin, users.show);
    app.get('/users/new', auth.requiresLogin, auth.requiresAdmin, users.new);
    app.post('/users', auth.requiresLogin, auth.requiresAdmin, users.add);
    //app.post('/users/:id', users.update);

    // THIS SHOULD BE A DELETE VERB!
    app.get('/users/delete/:id', auth.requiresLogin, auth.requiresAdmin, users.remove);

};
var express = require('express'),
    env = process.env.NODE_ENV || 'development',
    config = require('./config/config')[env],
    app = express(),
    mongoose = require('mongoose'),
    //auth = require('./lib/authentication'),
    passport = require('passport');

// Setup db connection
mongoose.connect(config.db);

// Load model
require('./lib/user');
// Load Passport
require('./config/passport')(passport, config);
// Setup Express
require('./config/express')(app, config, passport);
// Load the routes
require('./config/routes')(app, passport);

// Go
app.listen(config.admin_port);
console.log('Admin Server running at http://localhost:' + config.admin_port + '/');

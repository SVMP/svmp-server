'use strict';

var mongoose = require('mongoose');
var env = process.env.NODE_ENV || 'development';
var config = require('../config/config')[env];
require('../lib/user');
var User = mongoose.model('User');


mongoose.connect(config.db);

var test_user_data = [
    {username: 'mitre',
        password: 'mitre',
        vminstance_id: '',
        vminstance_ip: '',
        vminstance_port: 0,
        admin: true}
];

function done(err) {
    if (err) {
        console.log("Error: ", err);
    }
    mongoose.disconnect(function () {
        console.log("Finished...shut down connection");
    });
}

User.create(test_user_data, function (err, user) {
    if (err) {
        done(err);
    } else {
        done();
    }
});
'use strict';

var mongoose = require('mongoose');
var env = process.env.NODE_ENV || 'development';
var config = require('../config/config')[env];
require('../lib/user');
var User = mongoose.model('User');


mongoose.connect(config.db);
// vminstance_id: {type: String},
// vminstance_ip: {type: String},
// vmdevice: {type: String},
// admin: {type: Boolean, default: false}
var test_user_data = [
    {username: 'dave',
        password: 'dave',
        vminstance_id: "1234",
        vminstance_ip: "123.45.65.34",
        vminstance_port: 5000,
        admin: true},
    {username: 'bob',
        password: 'bob',
        vminstance_id: "12343",
        vminstance_ip: "123.66.65.34",
        vminstance_port: 5000,
        admin: false},
    {username: 'carl',
        password: 'carl',
        vminstance_id: "2222",
        vminstance_ip: "333.45.65.34",
        vminstance_port: 5000,
        admin: false}
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
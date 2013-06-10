'use strict';
/**
 * CRUD Users
 * @type {*}
 * @author Dave Bryson
 */
var mongoose = require('mongoose');
var User = mongoose.model('User');

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
            res.render('index', {users: users});
        }
    });
};

exports.new = function (req, res) {
    res.render('new', {user: new User({}), message: ''});
    //res.render('new');
};

/**
 * Show a User be ID
 * @param req
 * @param res
 */
exports.show = function (req, res) {
    User.findById(req.params.id, function (err, user) {
        if (err) {
            res.status(500).send({ error: "Error finding User: " + req.params.id });
        } else {
            console.log('User ', user);
            res.render('show', {user: user});
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
                res.render('new', {message: 'User already exists', user: user});
            } else {
                res.render('new', {message: 'Error adding the user', user: user});
            }
        } else {
            res.redirect('/users');
        }
    });
};

/**
 * Update a User for a given ID
 * @param req
 * @param res
 */
exports.update = function (req, res) {
    User.update({'_id': req.params.id}, req.body, function (err, user) {
        if (err) {
            res.status(500).send({error: "Error updating User"});
        } else {
            res.send(user);
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
        res.redirect('/users');
    });
};

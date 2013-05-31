'use strict';


exports.login = function (req, res) {
    res.render('login', {message: req.flash('info')});
};


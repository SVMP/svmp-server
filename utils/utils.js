'use strict';
var crypto = require('crypto');

/**
 * Generate unique session key
 * TODO: Make longer
 * @returns {*}
 */
exports.generate_session_key = function () {
    var seed = crypto.randomBytes(20);
    return crypto.createHash('sha1').update(seed).digest('hex');
};
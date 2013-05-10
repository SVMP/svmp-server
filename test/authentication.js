
var auth = require('../lib/authentication');

var good = {type: 'USERAUTH', authentication: {un: 'dave', pw: 'dave'}};
var badType = {type: 'USUTH', authentication: {un: 'dave', pw: 'dave'}};
var badUserPass = {type: 'USERAUTH', authentication: {un: 'bob', pw: 'dave'}};

exports.testAuthPasses = function (test) {
    auth.authenticate(good, function (err,user) {
        test.strictEqual(err,null);
        test.strictEqual(user.pw,'dave');
    });
    test.done();
};

exports.testBadMessageType = function (test) {
    auth.authenticate(badType, function (err,user) {
        test.notStrictEqual(err,null);
        test.strictEqual(user,undefined);
        test.strictEqual(err,"Bad Request");
    });
    test.done();
};

exports.testBadUsernamePassword = function (test) {
    auth.authenticate(badUserPass, function (err,user) {
        test.notStrictEqual(err,null);
        test.strictEqual(user,undefined);
        test.strictEqual(err,"Bad Username or Password");
    });
    test.done();
};
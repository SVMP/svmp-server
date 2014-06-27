/*
 * Copyright 2013-2014 The MITRE Corporation, All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this work except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * author Dave Bryson
 *
 */

var
    Q = require('q'),
    assert = require('assert'),
    auth = require('../../lib/authentication/index'),
    svmp = require('../../lib/svmp');


describe("Authentication/Session logic spec", function () {

    /*beforeEach(function (done) {
        svmp.users.clearUsers(function () {
            svmp.users.createUser('dave', 'dave', 'a', function () {
                done();
            });
        });
    });*/


    it('should contain one user', function (done) {
        svmp.users.listUsers(function (err, r) {
            assert.ok(r);
            var size = r.length;
            assert.equal(size, 1);
            done();
        });

    });

    // by default, when a user is created, the "password_change_needed" attribute is set to "true"
    it('when receiving AUTHENTICATION, should return NEED_PASSWORD_CHANGE when a new password is required', function (done) {
        svmp.config.set('settings:use_pam', false);
        svmp.config.set('settings:use_tls_user_auth', false);

        var a = auth.Authentication.loadStrategy();

        var protoMsg = {
            type: 'AUTH',
            authRequest: {
                type: 'AUTHENTICATION',
                username: 'dave',
                password: 'dave'
            }
        };

        var requestObj = svmp.protocol.parseRequest(svmp.protocol.writeRequest(protoMsg));

        a.authenticate(requestObj)
            .fail(function (err) {
                assert.strictEqual(err.responseType, 'NEED_PASSWORD_CHANGE')
            }).then(done, done);
    });

    it('when receiving PASSWORD_CHANGE, should fail with bad password', function (done) {
        svmp.config.set('settings:use_pam', false);
        svmp.config.set('settings:use_tls_user_auth', false);

        var a = auth.Authentication.loadStrategy();

        var protoMsg = {
            type: 'AUTH',
            authRequest: {
                type: 'PASSWORD_CHANGE',
                username: 'dave',
                password: 'bad',
                newPassword: 'dave2'
            }
        };

        var requestObj = svmp.protocol.parseRequest(svmp.protocol.writeRequest(protoMsg));

        a.authenticate(requestObj)
            .fail(function (err) {
                assert.strictEqual(err.responseType, 'PASSWORD_CHANGE_FAIL')
            }).then(done, done);
    });

    it('when receiving PASSWORD_CHANGE, should pass and change password', function (done) {
        svmp.config.set('settings:use_pam', false);
        svmp.config.set('settings:use_tls_user_auth', false);

        var a = auth.Authentication.loadStrategy();

        var protoMsg = {
            type: 'AUTH',
            authRequest: {
                type: 'PASSWORD_CHANGE',
                username: 'dave',
                password: 'dave',
                newPassword: 'dave2'
            }
        };

        var requestObj = svmp.protocol.parseRequest(svmp.protocol.writeRequest(protoMsg));

        a.authenticate(requestObj)
            .then(function (r) {
                assert.ok(r.session.sid);
                assert.equal(r.user.username, 'dave');
            }).then(done, done);
    });

    it('when receiving AUTHENTICATION, should pass and create a new session', function (done) {
        svmp.config.set('settings:use_pam', false);
        svmp.config.set('settings:use_tls_user_auth', false);

        var a = auth.Authentication.loadStrategy();

        var protoMsg = {
            type: 'AUTH',
            authRequest: {
                type: 'AUTHENTICATION',
                username: 'dave',
                password: 'dave2'
            }
        };


        var requestObj = svmp.protocol.parseRequest(svmp.protocol.writeRequest(protoMsg));

        a.authenticate(requestObj)
            .then(function (r) {
                assert.ok(r.session.sid);
                assert.equal(r.user.username, 'dave');
            }).then(done, done);

    });

    it('when receiving AUTHENTICATION, should fail with bad username', function (done) {
        svmp.config.set('settings:use_pam', false);
        svmp.config.set('settings:use_tls_user_auth', false);

        var a = auth.Authentication.loadStrategy();

        var protoMsg = {
            type: 'AUTH',
            authRequest: {
                type: 'AUTHENTICATION',
                username: 'bill',
                password: 'dave'
            }
        };


        var requestObj = svmp.protocol.parseRequest(svmp.protocol.writeRequest(protoMsg));

        a.authenticate(requestObj)
            .fail(function (err) {
                assert.strictEqual(err.responseType, 'AUTH_FAIL')
            }).then(done, done);

    });

    // Can't test this because of how lastAction works in session create..

    it('when sending SESSION_TOKEN, should re-authenticate an existing session without login', function (done) {
        svmp.config.set('settings:use_pam', false);
        svmp.config.set('settings:use_tls_user_auth', false);
        svmp.config.set('settings:max_session_length', 300); // make sure the max session length is long enough to test
        svmp.config.set('settings:session_token_ttl', 300); // make sure the session grace period is long enough to test

        var a = auth.Authentication.loadStrategy();

        svmp.session.create({user: {username: 'dave'}}).then(function (r) {
            // the session has been created, the user now is "connected"
            // lastAction is currently Date(0)
            // now, simulate the user disconnecting
            var sess = r.session;
            sess.lastAction = new Date(); // set the lastAction to now
            sess.save(function (err, sess, numberAffected) {
                if (err) {
                    assert.strictEqual(err, 'Unable to save session');
                } else {
                    // the user is now "disconnected"; re-authenticate with the session token
                    var sid = sess.sid;

                    var protoMsg = {
                        type: 'AUTH',
                        authRequest: {
                            type: 'SESSION_TOKEN',
                            username: 'dave',
                            sessionToken: sid
                        }
                    };

                    var requestObj = svmp.protocol.parseRequest(svmp.protocol.writeRequest(protoMsg));
                    a.authenticate(requestObj)
                        .then(function (r) {
                            assert.ok(r.session.sid);
                            assert.equal(r.user.username, 'dave');
                        }).then(done, done);
                }
            });
        });
    });

    it('should load db authentication strategy', function (done) {
        svmp.config.set('settings:use_pam', false);
        svmp.config.set('settings:use_tls_user_auth', false);

        var a = auth.Authentication.loadStrategy();
        assert.strictEqual(a.name, 'db');
        done();
    });


    it('should load pam authentication strategy', function (done) {
        svmp.config.set('settings:use_pam', true);
        svmp.config.set('settings:use_tls_user_auth', false);
        var pa = auth.Authentication.loadStrategy();
        assert.strictEqual(pa.name, 'pam');
        done();
    });

    it('should load tls authentication strategy', function (done) {
        svmp.config.set('settings:use_pam', false);
        svmp.config.set('settings:tls_proxy', true);
        svmp.config.set('settings:use_tls_user_auth', true);

        // Set an object as parameter for 'cert'
        var pa = auth.Authentication.loadStrategy({});
        assert.strictEqual(pa.name, 'tls');
        done();
    });

});

/*
 * Copyright 2013 The MITRE Corporation, All Rights Reserved.
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

var mongoose = require('mongoose'),
    Q = require('q'),
    assert = require('assert'),
    auth = require('../lib/authentication'),
    users = require('../lib/users'),
    session = require('../lib/session'),
    config = require('../config/config');


after(function(done) {
    mongoose.connection.close(function() {
        done();
    });
});

describe("Authentication/Session logic spec", function() {
    mongoose.createConnection(config.settings.test_db);
    
    var a = new auth.Authentication();

    before(function(done) {
        users.clearUsers(function() {
            users.createUser('dave','dave', function(){
                session.testSession('1', 'dave', function() {
                    done();
                });
            });
        });
    });

    it('should contain one user', function(done) {
        users.listUsers(function(err, r) {
            assert.ok(r);
            var size = r.length;
            assert.equal(size, 1);
            done();
        });

        //users.listUsers().then( function(all) {
        //    var size = all.length;
        //    assert.equal(size, 1);
        //}).then(done).fail(done);
    });
    

    it('should pass authentication creating a new session', function(done) {
        var obj = {username: 'dave', password: 'dave', sessionToken: ''};
        a.authenticate(obj).then(function(r) {
            assert.ok(r.sid);
            assert.equal(r.username, 'dave');
            assert.equal(r.vm, '');
        }).then(done).fail(done);
    });

    it('should re-authenticate an existing session without login', function(done){
        var obj = {username: 'dave', password: 'dave', sessionToken: '1'};
        a.authenticate(obj).then(function(r) {
            assert.equal(r.sid, '1');
            assert.equal(r.username, 'dave');
            assert.equal(r.vm, '');
        }).then(done).fail(done);

    });

    it('should fail on bad username or password', function(done) {
        var obj = {username: 'bad', password: 'man', sessionToken: ''};
        a.authenticate(obj).fail( function(err) {
            assert.equal(err, 'Bad Username or Password');
            done();
        }).fail(done);
    });

});

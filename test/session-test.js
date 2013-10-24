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
var mongoose = require('mongoose');
var assert = require("assert");
var session = require('../lib/session');
var config = require('../config/config').settings

 
describe('Session Test', function () {
    mongoose.connect(config.test_db);

    beforeEach(function(done) {
        session.clearSessions(function() {
            session.testSession('123', 'dave', function() {
                done();
            });
        });
    });

    it('should create a session', function (done) {
        var obj = {username: 'bob'};
        session.create(obj).then(function(sess) {
            assert.ok(sess.sid);
            assert.equal(sess.username, 'bob');
        }).then(done).fail(done);
    });

    it('should return original request object on bad/expired sessionid', function (done) {
        var obj = {sessionToken: '13', username: 'dave', password: 'dave'};
        session.get(obj).fail(function(result) {
            assert.ok(result.sessionToken);
            assert.equal('dave',result.username);
            done();    
        }).fail(done);
    });


});
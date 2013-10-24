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
    Schema = mongoose.Schema,
    Q = require('q');

// Schema for a user of the Proxy
var ProxyUserSchema = new Schema({
    username: {type: String, unique: true, index: true, required: true},
    password: String, // Optional
    vm_id: String, 
    vm_ip: String
});

// Setup Schema
var Model = mongoose.model('proxyusers', ProxyUserSchema);


exports.listUsers = function (callback) {
    /*var deferred = Q.defer();  
    Model.find({}, function (err, users) {
        if(users){
            console.log("Got users");
            deferred.resolve(users);    
        } else {
            deferred.reject(new Error('Error listing Users: ' + err));    
        }
    });
    return deferred.promise;*/
    Model.find({}, function (err, users) {
        if(users){
            callback(undefined, users);    
        } else {
            callback('Error listing Users');
        }
    });


}

exports.clearUsers = function (callback) {
    Model.remove({}, callback);
}

exports.findUser= function (obj) {
    var deferred = Q.defer();
    Model.findOne({username: obj.username}, function(err, user) {
        if(err) {
            deferred.reject(new Error('User not found'));
        } else {
            obj.vm = user.vm_ip
            deferred.resolve(obj);   
        }
    }); 
    return deferred.promise;   
}

exports.createUser = function(username, password, callback) {
    var user = new Model({username: username, password: password, vm_ip: '', vm_id: ''});
    user.save(function(err,u) {
        if(err) {
            var msg = "Error saving user: " + err;
            callback(msg);
        } else {
            callback(undefined, u);
        }
    });
}

exports.authenticateUser = function (obj, callback) {
    var un = obj.username;
    var pw = obj.password;
    if( un && pw ) {
        Model.findOne({username: un, password: pw}, function(err, user) {
            if(user) {
                callback(undefined,{username: user.username});   
            } else {
                callback("Bad Username or Password"); 
            } 
        });
    } else {
        callback("Missing Username or Password"); 
    }
}



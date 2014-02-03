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
var Pkgcloud = require('pkgcloud'),
    settings = global.config.settings;

var client = Pkgcloud.providers.openstack.compute.createClient(settings.openstack);

exports.getImages = function(callback) {
	client.getImages(function(err, images){
      var list = [];
      if (err) {
        callback(err);
      }
      images.forEach(function(v,i,d){ 
        list.push({_id: v.id, name: v.name});
      });
      callback(undefined,list);
    });
};

// Where object should be {user_id: useridentifier, flavor: flava, image: im};
exports.createVM = function (obj, callback) {
	obj.name = "svmp_user_vm_" + obj.user_id;
	client.createServer(obj, function (err, server) {
    	if(err){
        	console.log("Error: ", err);
        	callback(err);
      	} else {
      		server.setWait({status: server.STATUS.running}, 5000, function (err) {
      			if(err) {
      				callback(err);
      			} else {
              if (server.addresses && server.addresses.private && server.addresses.private.length > 0 )
              {
                  callback(undefined, {id: server.id, ip: server.addresses.private[0]});
              } else {
                callback("Cannot get IP for VM");
              }
      			}
      		});
      	}
    });
};
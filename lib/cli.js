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

/**
 * Command line app to manage the Proxy
 */ 

var program = require('commander'),
    colors = require('colors'),
    mongoose = require('mongoose'),
    config = require('../config/config');

colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red'
});

// before doing anything else, read the config file and validate it
// if this is successful, the "global.config" object will exist
// if not, the process will exit with an error message
config.tryValidate();

// get settings from global config object
var settings = global.config.settings;

// now that the global config object has been created, include sub-modules
var users = require('./users'),
    Openstack = require('./openstack');

// Connect to mongoose
// If you change this - change the call in proxy.js as well
// ... yea this should simplified ...
mongoose.connect(settings.db);

program.version('1.2.0');


program
    .command('list')
    .description('List proxy Users')
    .action(function(){
        console.log('   Proxy users:'.bold.help);
        console.log(''); 
        users.listUsers(function(err, list){
            if(list) {
                for(i=0; i<list.length; i++) {
                    var o = list[i];
                    var mo = {};
                    mo.username = o.username;
                    mo.vm_ip = o.vm_ip;
                    mo.vm_id = o.vm_id;
                    console.log('       * '.warn, JSON.stringify(mo).warn);
                }
            } else {
                console.log('Error: ', err);
            }
            mongoose.connection.close();
        });
    });

program
    .command('show <username>')
    .description('Show information about a user')
    .action(function(un) {
        console.log('');
        users.getUser(un, function(err, u) {
            if(u) {
                var o = {};
                o.username = u.username;
                o.vm_ip = u.vm_ip;
                o.vm_id = u.vm_id;
                console.log('   User'.bold.help);
                console.log('   ', JSON.stringify(o).data); 
                mongoose.connection.close();     
            } else {
                console.log("Error showing user " .error);
                mongoose.connection.close();    
            }
        }); 
    });

program
    .command('add <username> <password>')
    .description('Add a User to system')
    .action(function(un, pw){
        console.log('');
        console.log('    Adding User...'.help);
        users.createUser(un,pw,function(err,u) {
            if(u) {
                console.log("        Created user: ", u.username, ' Password: ', u.password);
                 mongoose.connection.close(); 
            } else {
                console.log("Problem creating user: ", err);
                mongoose.connection.close(); 
            }
        });
    });

program
    .command('vm <username> <image_id> <image_flavor>')
    .description('Create a vm for a user in the system. See \'images\' command')
    .action(function(un, imageid, imageflvr) {
        console.log(''); 
        console.log('    Creating a VM for ', un); 
        users.getUser(un, function(err, user) {
            if(user) {
                var obj = {user_id: un, flavor: imageflvr, image: imageid};
                Openstack.createVM(obj, function(err, r) {
                    if(err) {
                        console.log("        Error: ", err);
                        mongoose.connection.close();
                    } else {
                        user.vm_id = r.id;
                        user.vm_ip = r.ip;

                        user.save(function (err1, updateduser) {
                            if(updateduser) {
                                console.log("        VM created! IP: ", updateduser.vm_ip );
                                mongoose.connection.close();
                            } else {
                                console.log('        ERROR: ', err1);
                                mongoose.connection.close();   
                            }
                        });
                    }
                });    
            } else {
                console.log("Cannot find user: ", un);
                mongoose.connection.close();
            }
        });
    });

program
    .command('vm-add <username> <vm_ip_address>')
    .description('Register an existing VM at a given IP address to the user. (For testing/dev only.)')
    .action(function(un, vmip) {
        console.log('');
        console.log('    Adding existing VM for ', un);
        users.getUser(un, function(err, user) {
            if(user) {
                user.vm_ip = vmip;
                user.save(function (err1, updateduser) {
                    if(updateduser) {
                        console.log("        VM attached to user! IP: ", updateduser.vm_ip );
                        mongoose.connection.close();
                    } else {
                        console.log('        ERROR: ', err1);
                        mongoose.connection.close();
                    }
                });
            } else {
                console.log("Cannot find user: ", un);
                mongoose.connection.close();
            }
        });
    });

program
    .command('delete <username>')
    .description("Delete a User from the Proxy")
    .action(function(un) {
        console.log('    Delete a User:'.help);
        users.removeUser(un, function(err, r) {
            if(r) {
                console.log('        Deleted: ', un);
                mongoose.connection.close();
            } else {
                console.log('        Problem deleting user: ', un , ' reason: ', err);
                mongoose.connection.close();    
            }
        });
    });

program
    .command('images')
    .description("List available images and flavors on openstack. This information is needed when creating a VM")
    .action(function(){
        var flavas = [{value: '1', name: 'm1.tiny'},{value: '2', name: 'm1.small'},{value: '3', name: 'm1.medium'}];
        console.log('');
        console.log('    Image flavors available:');
        for(i=0; i<flavas.length;i++) {
            var o = flavas[i];
            var s = "      *    Value: " +  o.value  +  '  Description: ' +  o.name;
            console.log(s.verbose);
        }
        console.log("    NOTE: Use the value when choosing a Flavor");
        console.log('');
        console.log('    Openstack images:');
        Openstack.getImages(function(err,r) {
            if(r) {
                for(i=0; i<r.length;i++) {
                    var o = r[i];
                    var s = "      *    ID: " +  o._id  +  '  Name: ' +  o.name;
                    console.log(s.verbose);
                }
                console.log('');
            } else {

                console.log('Error: ', err);
                console('');
            }
        });
        mongoose.connection.close(); 
    });


if(process.argv.length <= 2) {
    console.log('');
    console.log('    Run:  ./bin/spm -h   to see available commands'.error);
    console.log('');
    process.exit();
} else {
    program.parse(process.argv);
}

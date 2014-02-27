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
    .action(function () {
        console.log('   Proxy users:'.bold.help);
        console.log('');
        users.listUsers(function (err, list) {
            if (list) {
                for (i = 0; i < list.length; i++) {
                    var o = list[i];
                    var mo = {};
                    mo.username = o.username;
                    mo.vm_ip = o.vm_ip;
                    mo.vm_id = o.vm_id;
                    mo.volume_id = o.volume_id;
                    console.log('       * '.warn, JSON.stringify(mo).warn);
                }
            } else {
                console.log('Error: ', err);
            }
            mongoose.connection.close();
        });
    });

program
    .command('clear-vm-info <username>')
    .description('Clear the Users VM and Volume Information')
    .action(function (un) {
        console.log('');
        users.findUser({username: un}).then(
            function(user) {
                user.vm_ip = "";
                user.vm_id = "";
                user.volume_id = "";
                return users.updateUser(user);
            }
        ).then( function(u) {
                console.log(u);
                console.log('   User'.bold.help);
                console.log('   ', JSON.stringify(u).data);
                mongoose.connection.close();

            },
            function(err) {
                console.log("Error showing user " + e.message);
                mongoose.connection.close();
            }
        );
    });

program
    .command('show <username>')
    .description('Show information about a user')
    .action(function (un) {
        console.log('');
        users.findUser({username: un}).then(
            function(user) {
                console.log(user);
                console.log('   User'.bold.help);
                console.log('   ', JSON.stringify(user).data);
                mongoose.connection.close();
            },
            function(err) {
                console.log("Error showing user ".error);
                mongoose.connection.close();
            }
        );
    });

program
    .command('add <username> <password>')
    .description('Add a User to system')
    .action(function (un, pw) {
        console.log('');
        console.log('    Adding User...'.help);
        users.createUser(un, pw, function (err, u) {
            if (u) {
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
    .description('Create and start a VM for a user in the system. See \'images\' command')
    .action(function (un, imageid, imageflvr) {
        console.log('');
        console.log('    Creating a VM for ', un, '... this may take a few seconds ...');

        users.findUser({username: un})
            .then(function(user){
                // The user SHOULD NOT have a VM id or VM ip already set.
                if(user.vm_id || user.vm_ip) {
                    throw new Error("User has VM or VM IP in record.");
                } else {
                    return Openstack.createAndStartVM(user, imageid, imageflvr)
                }
            })
            .then(users.updateUser)
            .then( function(result) {
                console.log("    VM created and running! IP: ", result.vm_ip);
                mongoose.connection.close();
            },
            function(err) {
                console.log("    Error: ", err.message, "".error);
                mongoose.connection.close();
            }
        );
    });

program
    .command('vm-add <username> <vm_ip_address>')
    .description('Register an existing VM at a given IP address to the user. (For testing/dev ONLY.)')
    .action(function (un, vmip) {
        console.log('');
        console.log('    Adding existing VM for ', un);

        users.findUser({username: un})
            .then(
            function (user) {
                user.vm_ip = vmip;
                return users.updateUser(user);

            })
            .then(
                function(user) {
                    console.log("    Success: Assigned IP to an existing VM");
                    mongoose.connection.close();
                },
                function(err) {
                    console.log("    ERROR registering a vm for an IP ", err.message);
                    mongoose.connection.close();
                }
            );
    });


program
    .command('volume-create <username>')
    .description('Create and assign a Volume to a user based on the gold snapshot id in config-local')
    .action(function (un) {
        console.log('');
        console.log('    Creating data volume for user ', un);

        users.findUser({username: un})
            .then(Openstack.createVolumeForUser)
            .then(function(info) {
                return users.updateUser(info.user);
            })
            .then(function(u) {
                console.log("    Volume created for: ", u.username);
                console.log("    ... information saved to User's account ...");
                console.log("    NOTE: The Volume is NOT attached to the User.");
                mongoose.connection.close();
            },
            function(err){
                console.log("    ERROR creating volume for User ", err.message);
                mongoose.connection.close();
            });
    });

program
    .command('volume-assign <username> <volume_id>')
    .description('Does not attach Volume to VM, simply associates an existing user data volume with the specified user.')
    .action(function (un, volid) {
        console.log('');
        console.log('    Associating volume ', volid, ' with user ', un);
        users.findUser({username: un})
            .then(
                function(user) {
                    user.volume_id = volid;
                    return users.updateUser(user);
                }
            )
            .then(function(u) {
                console.log("    Data volume associated with user! ID: ", u.volume_id);
                mongoose.connection.close();
            },function(err){
                console.log('    ERROR: ', err.message);
                mongoose.connection.close();
            });
    });

program
    .command('delete <username>')
    .description("Delete a User from the Proxy")
    .action(function (un) {
        console.log('    Delete a User:'.help);
        users.findUser({username: un})
            .then(
            function(user) {
                if(user) {
                    user.remove();
                    console.log('        Deleted: ', un);
                    mongoose.connection.close();
                }
            },
            function(err){
                console.log('        Problem deleting user: ', un, ' reason: ', err);
                mongoose.connection.close();
            }
            );
    });

program
    .command('images')
    .description("List available images and flavors on openstack. This information is needed when creating a VM")
    .action(function () {
        var flavas = [
            {value: '1', name: 'm1.tiny'},
            {value: '2', name: 'm1.small'},
            {value: '3', name: 'm1.medium'}
        ];
        console.log('');
        console.log('    Image flavors available:');
        for (i = 0; i < flavas.length; i++) {
            var o = flavas[i];
            var s = "      *    Value: " + o.value + '  Description: ' + o.name;
            console.log(s.verbose);
        }
        console.log("    NOTE: Use the value when choosing a Flavor");
        console.log('');
        console.log('    Openstack images:');
        Openstack.getImages(function (err, r) {
            if (r) {
                for (i = 0; i < r.length; i++) {
                    var o = r[i];
                    var s = "      *    ID: " + o._id + '  Name: ' + o.name;
                    console.log(s.verbose);
                }
                console.log('');
            } else {

                console.log('Error: ', err);
                console.log('');
            }
        });
        mongoose.connection.close();
    });


if (process.argv.length <= 2) {
    console.log('');
    console.log('    Run:  ./bin/spm -h   to see available commands'.error);
    console.log('');
    process.exit();
} else {
    program.parse(process.argv);
}

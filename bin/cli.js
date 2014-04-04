#!/usr/bin/env node

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
 * @author Dave Bryson
 *
 */

/**
 * Command line app to manage the Proxy
 */

var
    program = require('commander'),
    colors = require('colors'),
    svmp = require('../lib/svmp');

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


program.version(svmp.VERSION);

program
    .command('list')
    .description('List proxy Users')
    .action(function () {
        console.log('   Proxy users:'.bold.help);
        console.log('');
        svmp.users.listUsers(function (err, list) {
            if (list) {
                for (i = 0; i < list.length; i++) {
                    var o = list[i];
                    var mo = {};
                    mo.username = o.username;
                    mo.vm_ip = o.vm_ip;
                    mo.vm_id = o.vm_id;
                    mo.volume_id = o.volume_id;
                    mo.device_type = o.device_type;
                    console.log('       * '.warn, JSON.stringify(mo).warn);
                }
            } else {
                console.log('Error: ', err);
            }
            svmp.shutdown();
        });
    });

program
    .command('devices')
    .description('List supported device types')
    .action(function () {
        console.log('   Supported device types (settings.new_vm_defaults.images):'.bold.help);
        console.log('');
        var images = svmp.config.get('settings:new_vm_defaults:images');
        for (var key in images) {
            console.log('       * '.warn, JSON.stringify(key).warn);
        }
        svmp.shutdown();
    });

program
    .command('clear-vm-info <username>')
    .description('Clear the Users VM and Volume Information')
    .action(function (un) {
        console.log('');
        svmp.users.findUser({username: un}).then(
            function (user) {
                // note: vm_ip and vm_id MUST be undefined for the "setupuser" module to create a new VM when this user logs in
                user.vm_ip = undefined;
                user.vm_id = undefined;
                user.volume_id = "";
                return svmp.users.updateUser(user);
            }
        ).then(function (u) {
                console.log(u);
                console.log('   User'.bold.help);
                console.log('   ', JSON.stringify(u).data);
                svmp.shutdown();
            },
            function (err) {
                console.log("Error showing user " + e.message);
                svmp.shutdown();
            }
        );
    });

program
    .command('show <username>')
    .description('Show information about a user')
    .action(function (un) {
        console.log('');
        svmp.users.findUser({username: un}).then(
            function (user) {
                console.log(user);
                console.log('   User'.bold.help);
                console.log('   ', JSON.stringify(user).data);
                svmp.shutdown();
            },
            function (err) {
                console.log("Error showing user ".error);
                svmp.shutdown();
            }
        );
    });

program
    .command('add <username> <password> <device_type>')
    .description('Add a User to system')
    .action(function (un, pw, dev) {
        console.log('');
        console.log('    Adding User...'.help);
        var images = svmp.config.get('settings:new_vm_defaults:images');
        if (!dev || dev.length == 0 || !images.hasOwnProperty(dev)) {
            console.log("Problem creating user: device not recognized (run ./bin/cli devices to see available devices)".error);
            svmp.shutdown();
        }
        else {
            svmp.users.createUser(un, pw, dev, function (err, u) {
                if (u) {
                    console.log("        Created user: ", u.username, ' Password: ', u.password, ' Device: ', u.device_type);
                } else {
                    console.log("Problem creating user: ", err);
                }
                svmp.shutdown();
            });
        }
    });

program
    .command('vm <username> <image_id> <image_flavor>')
    .description('Create and start a VM for a user in the system. See \'images\' command')
    .action(function (un, imageid, imageflvr) {
        console.log('');
        console.log('    Creating a VM for ', un, '... this may take a few seconds ...');

        svmp.users.findUser({username: un})
            .then(function (user) {
                // The user SHOULD NOT have a VM id or VM ip already set.
                if (user.vm_id || user.vm_ip) {
                    throw new Error("User has VM or VM IP in record.");
                } else {
                    return svmp.openstack.createAndStartVM(user, imageid, imageflvr)
                }
            })
            .then(svmp.users.updateUser)
            .then(function (result) {
                console.log("    VM created and running! IP: ", result.vm_ip);
                svmp.shutdown();
            },
            function (err) {
                console.log("    Error: ", err.message, "".error);
                svmp.shutdown();
            }
        );
    });

program
    .command('vm-add <username> <vm_ip_address>')
    .description('Register an existing VM at a given IP address to the user. (For testing/dev ONLY.)')
    .action(function (un, vmip) {
        console.log('');
        console.log('    Adding existing VM for ', un);

        svmp.users.findUser({username: un})
            .then(
            function (user) {
                user.vm_ip = vmip;
                return svmp.users.updateUser(user);

            })
            .then(
            function (user) {
                console.log("    Success: Assigned IP to an existing VM");
                svmp.shutdown();
            },
            function (err) {
                console.log("    ERROR registering a vm for an IP ", err.message);
                svmp.shutdown();
            }
        );
    });


program
    .command('volume-create <username>')
    .description('Create and assign a Volume to a user based on the gold snapshot id in config-local')
    .action(function (un) {
        console.log('');
        console.log('    Creating data volume for user ', un);

        svmp.users.findUser({username: un})
            .then(svmp.openstack.createVolumeForUser)
            .then(function (info) {
                return svmp.users.updateUser(info.user);
            })
            .then(function (u) {
                console.log("    Volume created for: ", u.username);
                console.log("    ... information saved to User's account ...");
                console.log("    NOTE: The Volume is NOT attached to the User.");
                svmp.shutdown();
            },
            function (err) {
                console.log("    ERROR creating volume for User ", err.message);
                svmp.shutdown();
            });
    });

program
    .command('volume-assign <username> <volume_id>')
    .description('Does not attach Volume to VM, simply associates an existing user data volume with the specified user.')
    .action(function (un, volid) {
        console.log('');
        console.log('    Associating volume ', volid, ' with user ', un);
        svmp.users.findUser({username: un})
            .then(
            function (user) {
                user.volume_id = volid;
                return svmp.users.updateUser(user);
            }
        )
            .then(function (u) {
                console.log("    Data volume associated with user! ID: ", u.volume_id);
                svmp.shutdown();
            }, function (err) {
                console.log('    ERROR: ', err.message);
                svmp.shutdown();
            });
    });

program
    .command('delete <username>')
    .description("Delete a User from the Proxy")
    .action(function (un) {
        console.log('    Delete a User:'.help);
        svmp.users.findUser({username: un})
            .then(
            function (user) {
                if (user) {
                    user.remove();
                    console.log('        Deleted: ', un);
                    svmp.shutdown();
                }
            },
            function (err) {
                console.log('        Problem deleting user: ', un, ' reason: ', err);
                svmp.shutdown();
            }
        );
    });

program
    .command('images')
    .description("List available images and flavors on openstack. This information is needed when creating a VM")
    .action(function () {

        console.log('');
        console.log('    Image flavors available:');

        svmp.openstack.getFlavors(function (err, allflavors) {
            if (err) {
                console.log("ERROR: ", err);
            } else {
                for (i = 0; i < allflavors.length; i++) {
                    var o = allflavors[i];
                    var s = "      *    ID: " + o._id + '  Name: ' + o.name;
                    console.log(s.verbose);
                }
                console.log('');
                console.log("    NOTE: Use the ID value (example: 1) when choosing a Flavor");
                console.log('');

                console.log('    Openstack images available:');
                svmp.openstack.getImages(function (err, r) {
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


            }
        });
        svmp.shutdown();
    });


if (process.argv.length <= 2) {
    console.log('');
    console.log('    Run:  ./bin/cli -h   to see available commands'.error);
    console.log('');
    process.exit();
} else {
    svmp.init();

    program.parse(process.argv);
}

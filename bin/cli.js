#!/usr/bin/env node

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
 * @author Dave Bryson
 *
 */

/**
 * Command line app to manage the Proxy
 */

var
    program = require('commander'),
    colors = require('colors'),
    svmp = require(__dirname + '/../lib/svmp'),
    Table = require('cli-table');

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
        console.log('');
        console.log('Proxy users:'.bold.help);
        svmp.overseerClient.listUsers(function (err, res) {
            if (!badResponse(err, res)) {
                var list = res.body.users;
                var table = new Table({
                    head: ['User', 'VM_IP', 'VM_ID', 'VOL_ID', 'Device']
                });

                for (var i = 0; i < list.length; i++) {
                    var o = list[i];
                    var vm_ip = o.vm_ip || "";
                    var vm_id = o.vm_id || "";
                    var volume_id = o.volume_id || "";
                    var device = o.device_type || "";

                    table.push([
                        o.username,
                        vm_ip,
                        vm_id,
                        volume_id,
                        device
                    ]);

                }
                console.log(table.toString());
                console.log('');
            }
            svmp.shutdown();
        });
    });

program
    .command('devices')
    .description('List supported device types')
    .action(function () {
        console.log('');
        console.log('Supported device types:'.bold.help);
        svmp.overseerClient.listDevices(function (err, res) {
            if (!badResponse(err, res)) {
                var images = res.body;
                var table = new Table({
                    head: ['Device Type']
                });
                for (var key in images) {
                    table.push([key]);
                }
                console.log(table.toString());
                console.log('');
            }
            svmp.shutdown();
        });
    });

program
    .command('clear-vm-info <username>')
    .description('Clear the Users VM Information')
    .action(function (un) {
        console.log('');
        console.log('Clearing user information...'.bold.help);
        var update = {vm_ip: "", vm_id: ""};
        svmp.overseerClient.updateUser(un, update, function (err, res) {
            if (!badResponse(err, res)) {
                console.log('    Done! Cleared VM IP and VM ID for user:', un);
                console.log('');
            }
            svmp.shutdown();
        });
    });

program
    .command('show <username>')
    .description('Show information about a user')
    .action(function (un) {
        console.log('');
        console.log('Finding user information...'.bold.help);
        svmp.overseerClient.getUser(un, function (err, res) {
            if (!badResponse(err, res)) {
                var user = res.body.user;
                console.log(JSON.stringify(user, null, 4).data);
                console.log('');
            }
            svmp.shutdown();
        });
    });

program
    .command('add <username> <password> <email> <device_type>')
    .description('Add a User to system. NOTE: this does NOT create a volume for the User! (Use this command if you aren\'t using a cloud platform)')
    .action(function (un, pw, email, dev) {
        console.log('');
        console.log('Adding a new user...'.bold.help);
        svmp.overseerClient.createUser(un, pw, email, dev, function (err, res) {
            if (!badResponse(err, res)) {
                console.log('    Done! Created user:', un);
                console.log('    NOTE: The user does NOT have a volume assigned; use the "volume-create" command to do so'.warn);
                console.log('');
            }
            svmp.shutdown();
        });
    });

program
    .command('add-user-with-volume <username> <password> <email> <device_type>')
    .description('Add a new User to the system and create a volume for the User')
    .action(function (un, pw, email, dev) {
        console.log('');
        console.log('Adding a new user...'.bold.help);
        svmp.overseerClient.createUser(un, pw, email, dev, function (err, res) {
            if (!badResponse(err, res)) {
                console.log('    Created user:', un);
                console.log('');

                // add the user's volume
                svmp.overseerClient.createVolume(un, function (err, res) {
                    if (!badResponse(err, res)) {
                        console.log('    Volume created for:', un);
                        console.log('    ... information saved to user\'s account ...');
                        console.log('    NOTE: The Volume is NOT attached to the user\'s VM.'.warn);
                        console.log('');
                    }
                    svmp.shutdown();
                });
            } else {
                svmp.shutdown();
            }
        });
    });

program
    .command('vm <username>')
    .description('Create and start a VM for a user in the system.')
    .action(function (un, imageid, imageflvr) {
        console.log('');
        console.log('Creating a new VM, this may take a few seconds...'.bold.help);

        svmp.overseerClient.setupVM(un, function (err, res) {
            if (!badResponse(err, res)) {
                console.log('    Done! VM created and running, IP:', res.body.vm_ip);
                console.log('');
            }
            svmp.shutdown();
        });
    });

program
    .command('vm-add <username> <vm_ip_address>')
    .description('Register an existing VM at a given IP address to the user. (For testing/dev ONLY.)')
    .action(function (un, vmip) {
        console.log('');
        console.log('Updating user\'s VM IP address...'.bold.help);

        var update = {vm_ip: vmip, vm_id: ""};
        svmp.overseerClient.updateUser(un, update, function (err, res) {
            if (!badResponse(err, res)) {
                console.log('    Done! Updated VM IP and cleared VM ID for user:', un);
                console.log('');
            }
            svmp.shutdown();
        });
    });


program
    .command('list-volumes')
    .description('list available volumes')
    .action(function () {
        console.log('');
        console.log('Available volumes:'.bold.help);

        svmp.overseerClient.listVolumes(function (err, res) {
            if (!badResponse(err, res)) {
                var r = res.body.volumes;
                var table = new Table({
                    head: ['Name', 'Status', 'ID']
                });

                for (var i = 0; i < r.length; i++) {
                    table.push(r[i]);
                }
                console.log(table.toString());
                console.log('');
            }
            svmp.shutdown();
        });
    });

program
    .command('volume-create <username>')
    .description('Create and assign a Volume to a user based on the gold snapshot id in config-local')
    .action(function (un) {
        console.log('');
        console.log('Creating data volume for user...'.bold.help);

        // add the user's volume
        svmp.overseerClient.createVolume(un, function (err, res) {
            if (!badResponse(err, res)) {
                console.log('    Done! Volume created for user:', un);
                console.log('    ... information saved to user\'s account ...');
                console.log('    NOTE: The Volume is NOT attached to the user\'s VM'.warn);
                console.log('');
            }
            svmp.shutdown();
        });
    });

program
    .command('volume-assign <username> <volume_id>')
    .description('Does not attach Volume to VM, simply associates an existing user data volume with the specified user.')
    .action(function (un, volid) {
        console.log('');
        console.log('Associating volume with user...'.bold.help);

        svmp.overseerClient.assignVolume(un, volid, function (err, res) {
            if (!badResponse(err, res)) {
                console.log('    Done! Updated volume ID for user:', un);
                console.log('');
            }
            svmp.shutdown();
        });
    });

program
    .command('delete <username>')
    .description('Delete a User from the Proxy')
    .action(function (un) {
        console.log('');
        console.log('Deleting user...'.bold.help);

        svmp.overseerClient.deleteUser(un, function (err, res) {
            if (!badResponse(err, res)) {
                console.log('    Done!');
                console.log('');
            }
            svmp.shutdown();
        });
    });

program
    .command('images')
    .description('List available images and flavors on your cloud platform; this information is needed when creating a VM')
    .action(function () {

        svmp.overseerClient.listImages(function (err, res) {
            if (!badResponse(err, res)) {
                console.log('');
                console.log('Image flavors available:'.bold.help);
                var flavorTable = new Table({
                    head: ['Name', 'ID']
                });
                for (i = 0; i < res.body.flavors.length; i++) {
                    var o = res.body.flavors[i];
                    flavorTable.push([o[1], o[0]]);
                }
                console.log(flavorTable.toString());
                console.log('');
                console.log('NOTE: Use the ID value when choosing a Flavor'.warn);
                console.log('');

                console.log('Images available:'.bold.help);
                var imgTable = new Table({
                    head: ['Name', 'ID']
                });
                for (i = 0; i < res.body.images.length; i++) {
                    var o = res.body.images[i];
                    imgTable.push([o[1], o[0]]);
                }
                console.log(imgTable.toString());
                console.log('');
            }
            svmp.shutdown();
        });
    });


if (process.argv.length <= 2) {
    console.log('');
    console.log('    Run "node ./bin/cli -h" to see available commands'.error);
    console.log('');
    process.exit();
} else {
    svmp.init();

    program.parse(process.argv);
}

// internal function
// returns 'true' and logs if there is an error
// returns 'false' if there is no error
function badResponse(err, response) {
    var errText;
    if (err) {
        errText = '    Error: ';
    }
    else if (response.status !== 200) {
        errText = '    Error code: ' + response.status + ', text: ' + response.text;
    }

    if (errText) {
        console.log(errText.error);
        console.log('');
        return true;
    }
    return false;
}

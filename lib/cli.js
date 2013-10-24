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
    config = require('../config/config').settings,
    users = require('./users');

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

// Connect to mongoose
mongoose.connect(config.test_db);

program.version('0.0.1');


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
        var u = {username: un};
        users.findUser(u).then(function(r) {
            console.log('   Users'.bold.help);
            console.log('   ', JSON.stringify(r).data);
            mongoose.connection.close();
        }, function(err) {
            console.log("Error showing user ".error);
            mongoose.connection.close();
        });
    });

program
    .command('add <username> <password>')
    .description('Add a User to system, creating a fresh VM')
    .action(function(un, pw){
        console.log('');
        console.log("add user...");    
    });

program
    .command('delete <username>')
    .description("Delete a User from the Proxy")
    .action(function(un) {
        console.log('');   
    });

program.parse(process.argv);
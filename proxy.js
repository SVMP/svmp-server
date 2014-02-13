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
'use strict';

var net = require('net'),
    tls = require('tls'),
    mongoose = require('mongoose'),
    fs = require('fs'),
    config = require('./config/config'),
    winston = require('winston');

// before doing anything else, read the config file and validate it
// if this is successful, the "global.config" object will exist
// if not, the process will exit with an error message
config.tryValidate();

// get settings from global config object
var settings = global.config.settings;

// Setup logger
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {level: settings.log_level, colorize: true});
winston.add(winston.transports.File, {filename: settings.log_file, level: settings.log_level});
winston.info("Starting proxy, log level: '%s'", settings.log_level);

// now that the global config object has been created, include sub-modules
var proxy = require('./lib/proxy'),
    auth = require('./lib/authentication'),
    pam = require('./lib/pam-auth-plugin');

// If we are using TLS, try to open the key and certificate files
if(settings.tls_proxy) {
    try {
        var tls_key = fs.readFileSync(settings.tls_private_key);
    } catch (err) {
        winston.error("Could not open TLS private key '%s' (check config.settings.tls_private_key)", settings.tls_private_key);
        process.exit(1);
    }
    try {
        var tls_cert = fs.readFileSync(settings.tls_certificate);
    } catch (err) {
        winston.error("Could not open TLS certificate '%s' (check config.settings.tls_certificate)", settings.tls_certificate);
        process.exit(1);
    }

    var tls_options = {
        key:  tls_key,
        cert: tls_cert
    };

    if (settings.use_tls_user_auth) {
        try {
            tls_options.ca = [ fs.readFileSync(settings.tls_ca_cert) ];
        } catch (err) {
            winston.error("Could not open TLS ca cert file '%s' (check config.settings.tls_ca_cert)", settings. tls_ca_cert);
            process.exit(1);
        }

        tls_options.requestCert = true;
        tls_options.rejectUnauthorized = true;
    }

}

// If you change this - change the call in cli.js as well
// ... yea this should simplified ...
mongoose.connect(settings.db);

/**
 * Example authentication callback function
 * User for testing
 */
function testAuth(reqObj,callback) {
    var un = reqObj.username;
    var pw = reqObj.password;
    if(un === 'dave' && pw === 'dave') {
        callback(undefined,{username: un});
    } else {
        callback('Login failure');
    }
}

function onConnection(proxySocket) {
    var gateGuard;

    // Example using the test function above
    //var gateGuard = new auth.Authentication(testAuth);

    if(settings.use_pam) {
        // Using PAM
        gateGuard = new auth.Authentication(pam.pamAuthentication);
    } else {
        // Example using the built in username/password in DB. Will set as default
        gateGuard = new auth.Authentication();
    }

    proxy.proxyConnection(proxySocket,gateGuard);
}

var server = settings.tls_proxy ? tls.createServer(tls_options, onConnection) : net.createServer(onConnection);
server.listen(settings.port);
winston.log('info', 'Proxy running on port %d Using TLS? %s', settings.port, settings.tls_proxy);

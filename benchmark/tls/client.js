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
var
    svmp = require('../../lib/svmp'),
    svmpSocket = require('../../lib/server/svmpsocket'),
    fs = require('fs'),
    path = require('path');

/**
 * Measure messages per second between SVMPSocket client and server.
 *
 */
svmp.init();

// Make sure to turn TLS on
svmp.config.set('settings:tls_proxy', true);
svmp.config.set('settings:use_tls_user_auth', false);

var
    port = svmp.config.get('settings:port'),
    counter = 0,
    interval = 5000,
    totalTestTime = 60000,
    data = [];

var
    keyFile = path.join(__dirname,'../../tls','test-key.pem'),
    certFile = path.join(__dirname,'../../tls','test-cert.pem'),
    caFile = path.join(__dirname,'../../tls','ca-cert.pem');

/** Setup up client to talk to server */
var
    options = {};
    options.type = 'tls',
    options.key = fs.readFileSync(keyFile),
    options.cert = fs.readFileSync(certFile),
    options.ca = fs.readFileSync(caFile),
    options.passphrase = '',
    options.rejectUnauthorized = false;

var
    client = new svmpSocket.SvmpSocket(undefined, options);


function finish () {
    console.log("** Done! ** ");
    var trimmed = data.slice(1); // Remove the first message reported by count.

    var sum = 0, average = 0;
    for (var i = 0; i < trimmed.length; i++) {
        sum += trimmed[i];
    }

    if( trimmed.length > 0 ) {
        average = sum / trimmed.length;
        console.log("Average msgs/sec: ", average);
    }
    process.exit(0);
}



function count() {
    data.push(counter / interval * 1000);
    counter = 0;
    setTimeout(count, interval);
}


client.on('message', function (msg) {
    var r = svmp.protocol.parseResponse(msg);

    // Only count if you get a valid message
    if(r.message === 'test1') {
        counter++;
    }

    client.sendRequest({
        type: 'AUTH',
        authRequest: {
            type: 'AUTHENTICATION',
            username: 'dave'
        }
    });
});

client.on('start', function () {
    client.sendRequest({
        type: 'AUTH',
        authRequest: {
            type: 'AUTHENTICATION',
            username: 'dave'
        }
    });
    count();
    setTimeout(finish, totalTestTime);
});

// GO
client.connect(port);
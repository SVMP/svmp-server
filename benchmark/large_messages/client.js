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
    crypto = require('crypto')

/**
 * Measure messages per second between SVMPSocket client and server.
 *
 */
svmp.init();


//var SID = crypto.randomBytes(64).toString('hex');
var SID =  "1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890";
var SAMPLE = {
    type: 'AUTH',
    authRequest: {
        type: 'AUTHENTICATION',
        username: 'dave',
        sessionToken: SID,
        password: "blahblahblah",
        securityToken: "1234567890"
    }
};


// Make sure to turn TLS off
svmp.config.set('settings:tls_proxy', false);

var
    port = svmp.config.get('settings:port'),
    client = new svmpSocket.SvmpSocket(),
    counter = 0,
    interval = 5000,
    totalTestTime = 60000,
    data = [];


function finish() {
    console.log("** Done! ** ");
    var trimmed = data.slice(1); // Remove the first message reported by count.

    var sum = 0, average = 0;
    for (var i = 0; i < trimmed.length; i++) {
        sum += trimmed[i];
    }

    if (trimmed.length > 0) {
        average = sum / trimmed.length;
        console.log("Average msgs/sec: ", average);
    }
    process.exit(0);
}


function count() {
    //var value = counter / interval * 1000;
    data.push(counter / interval * 1000);
    counter = 0;
    setTimeout(count, interval);
}

client.on('message', function (msg) {
    var r = svmp.protocol.parseResponse(msg);
    // Only count if you get a valid message
    if (r.message === 'test1') {
        counter++;
    }

    client.sendRequest(SAMPLE);
});

client.on('start', function () {
    client.sendRequest(SAMPLE);
    count();
    setTimeout(finish, totalTestTime);
});

// GO
client.connect(port);

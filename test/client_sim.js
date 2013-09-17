'use strict';

var net = require('net'),
    tls = require('tls'),
    fs = require('fs'),
    env = process.env.NODE_ENV || 'development',
    config = require('../config/config').settings,
    proto = require('../lib/protocol');

function SimClient() {
    var client;
    if (config.tls_proxy) {
        var options = {
            key: fs.readFileSync('../tls/private-key.pem'),
            cert: fs.readFileSync('../tls/public-cert.pem')
        };
        client = tls.connect(config.port, 'localhost', options, function () {
            if (client.authorized) {
                console.log("Connection authorized by a Certificate Authority.");
                proto.writeRequest({type: 'USERAUTH', authentication: {un: 'dave', pw: 'dave'}}, client);
            } else {
                console.log("Connection not authorized: " + conn.authorizationError);
            }
            proto.writeRequest({type: 'USERAUTH', authentication: {un: 'dave', pw: 'dave'}}, client);
        });
    } else {
        client = net.connect(8001, function () {
            proto.writeRequest({type: 'USERAUTH', authentication: {un: 'dave', pw: 'dave',  secureid: '123'}}, client);
        });
    }

    client.on('data', function (data) {
        var resp = proto.readResponse(data);
        console.log("GOT: ", resp);
        if (resp.type === 'VMREADY') {
            proto.writeRequest({type: 'VIDEO_PARAMS'}, client);
            console.log("Send VIDEO request");
        }
        if(resp.type === 'VIDSTREAMINFO') {
            console.log("GOT STREAM INFO")
        }
    });
    client.on('error', function (err) {
        console.log("GOT ERROR: ", err);
    });
}


SimClient();

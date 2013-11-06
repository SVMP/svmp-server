'use strict';

var net = require('net'),
    tls = require('tls'),
    fs = require('fs'),
    env = process.env.NODE_ENV || 'development',
    config = require('../config/config').settings,
    proto = require('../lib/protocol');

function SimClient() {
    var client = net.connect(config.port, function () {
        var authMsg = {
            type: 'AUTH',
            authRequest: {
                type: "AUTHENTICATION",
                username: "dave",
                // left out session token on purpose
                password: 'dave'
                // left out security token on purpose
            }
        };
        console.log("Connected...");
        proto.sendRequest( authMsg, client);
    });
    
    client.on('data', function (data) {
        var resp = proto.readResponse(data);

        if (resp.type === 'AUTH') {
            if (resp.authResponse.type === 'AUTH_OK')
                console.log("Got AUTH OK.  SID: ", resp.authResponse.sessionToken);
            else if (resp.authResponse.type === 'AUTH_FAIL')
                console.log("Got AUTH FAIL.");
        }

        if (resp.type === 'VMREADY') {
            console.log("Got VMREADY: ", resp.message);
            proto.sendRequest({type: 'VIDEO_PARAMS'}, client);
        }
        if(resp.type === 'VIDSTREAMINFO') {
            console.log("GOT STREAM INFO, Rett 2 go...: ", resp.videoInfo);
        }

        if( resp.type === 'ERROR') {
            console.log("Error message: ", resp.message);
        }
    });
    client.on('error', function (err) {
        console.log("GOT ERROR: ", err);
    });
}


SimClient();

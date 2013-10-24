'use strict';

var net = require('net'),
    tls = require('tls'),
    fs = require('fs'),
    env = process.env.NODE_ENV || 'development',
    config = require('../config/config').settings,
    proto = require('../lib/protocol');

function SimClient() {
    var client = net.connect(config.port, function () {
        var authMsg = { type: 'USERAUTH', 
                        authentication: {username: "dave", 
                            entries: [{key:'password', value:'dave'}, 
                                      {key: 'sessionToken', value: ''},
                                      {key: 'testing', value: 'true'}
                            ]
                        } 
        };
        console.log("Connected...");
        proto.sendRequest( authMsg, client);
    });
    
    client.on('data', function (data) {
        var resp = proto.readResponse(data);

        if( resp.type === 'AUTHOK') {
            console.log("Got AUTH OK.  SID: ", resp.message);
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

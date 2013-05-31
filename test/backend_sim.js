'use strict';

var net = require('net');
var proto = require('../lib/protocol');


function createServers() {

    net.createServer(function (s) {
        s.on('data', function (data) {
            var req = proto.readRequest(data);
            //console.log("GOT REQUEST");
            if (req.type === 'RAWINPUTPROXY') {
                proto.writeResponse({type: 'SCREENINFO', screen_info: {x: 10, y: 10}}, s);
            } else {
                proto.writeResponse({"type": "ERROR", "message": "Parser: Bad formed message"}, s);
            }

        });
    }).listen(8003);
    //console.log("VM running on port 8003...");
}


createServers();


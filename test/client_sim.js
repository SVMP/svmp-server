'use strict';

var net = require('net');
var proto = require('../lib/protocol');

var AUTH = false;
function SimClient() {
    var client = new net.Socket();

    client.on('data', function (data) {
        var resp = proto.readResponse(data);
        if (resp.type === 'VMREADY') {
            proto.writeRequest({type: 'RAWINPUTPROXY', proxy: {type: 'INPUT'}}, client);
        }
    });

    client.connect(8001, function () {
        proto.writeRequest({type: 'USERAUTH', authentication: {un: 'dave', pw: 'dave'}}, client);
    });
}


SimClient();

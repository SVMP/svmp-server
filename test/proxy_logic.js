
var net = require('net');
var proxy = require('../lib/proxy');
var proto = require('../lib/protocol');
var users = require('../users/db.js');
var assert = require('assert');

//users.tester = {pw: 'tester', event: {ip: 'localhost', port: 8001}};

var PROXY_PORT = 8001;

var server = net.createServer(function (proxySocket) {
    proxy.proxyConnection(proxySocket);
}).listen(PROXY_PORT);


describe("Proxy Test", function () {
    it('should connect autheticate with proxy', function (done) {
        var client = net.Socket();
        client.on('data', function (data) {
            var resp = proto.readResponse(data);
            assert.equal(resp.type, "AUTHOK");
            client.end();
            done();
        });

        client.connect(8001, function () {
            proto.writeRequest({type: 'USERAUTH', authentication: {un: 'dave', pw: 'dave'}}, client);
        });

        client.on('close', function () {
            client.destroy();
        });
    });
});



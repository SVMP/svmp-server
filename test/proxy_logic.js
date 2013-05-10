'use strict';

var net = require('net');
var proxy = require('../lib/proxy');
var proto = require('../lib/protocol');
var users = require('../users/db.js');

users['tester'] = {pw: 'tester', vm: {ip: 'localhost', port: 8001}};

// test authentication works
exports.testGoodAuthentication = function (test) {
    var server  = net.createServer(function (proxySocket) {
        proxy.proxyConnection(proxySocket);
    }).listen(9000);

    var socket = new net.Socket();
    socket.connect(9000, function () {
        proto.writeRequest({type: 'USERAUTH', authentication: {un: 'tester', pw: 'tester'}}, socket);
        socket.on('data', function (data) {
            var resp = proto.readResponse(data);
            test.equal(resp.type, "AUTHOK");

            socket.end();
            server.close();
            test.done();
        });
    });
};
// test handles bad auth
exports.testBadAuthentication = function (test) {
    var server  = net.createServer(function (proxySocket) {
        proxy.proxyConnection(proxySocket);
    }).listen(9000);

    var socket = new net.Socket();
    socket.connect(9000, function () {
        proto.writeRequest({type: 'USERAUTH', authentication: {un: 'tester', pw: 'baduser'}}, socket);
        socket.on('data', function (data) {
            var resp = proto.readResponse(data);
            test.equal(resp.type, "ERROR");

            socket.end();
            server.close();
            test.done();
        });
    });
};
// test won't proxy without auth
exports.testProxyWithoutAuthentication = function (test) {
    var server  = net.createServer(function (proxySocket) {
        proxy.proxyConnection(proxySocket);
    }).listen(9000);

    var socket = new net.Socket();
    socket.connect(9000, function () {
        proto.writeRequest({type: 'RAWINPUTPROXY', proxy: {type: 'INPUT'}}, socket);
        socket.on('data', function (data) {
            var resp = proto.readResponse(data);
            test.equal(resp.type, "ERROR");

            socket.end();
            server.close();
            test.done();
        });
    });
};
// test proxies message round trip
exports.testProxyWithAuthentication = function (test) {
    var proxyServer  = net.createServer(function (proxySocket) {
        proxy.proxyConnection(proxySocket);
    }).listen(9000);

    var vmServer = net.createServer(function (s) {
        s.on('data', function (data) {
            proto.writeResponse({type: 'SCREENINFO', screen_info: {x: 10, y: 10}},s);
        });
    }).listen(8001);


    var socket = new net.Socket();
    var AUTHENTICATED = false;
    socket.connect(9000, function () {
        proto.writeRequest({type: 'USERAUTH', authentication: {un: 'tester', pw: 'tester'}}, socket);

        socket.on('data', function (data) {
            var resp = proto.readResponse(data);
            if ( !AUTHENTICATED ) {
                test.equal(resp.type, "AUTHOK");
                AUTHENTICATED = (resp.type === "AUTHOK");
                proto.writeRequest({type: 'RAWINPUTPROXY', proxy: {type: 'INPUT'}}, socket);
                test.done();
            } else {
                test.equal(resp.type, 'SCREENINFO');
                test.equal(resp.screen_info.x, 10);
                test.done();
            }
            socket.end();
            vmServer.close();
            proxyServer.close();
        });
    });
};
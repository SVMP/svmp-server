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
var local = require('./config-local');
var TTL = 5*60; // Currently 5 mins for testing
local.settings.session_timeout = TTL;
module.exports = local;
/**
 * Expects a file named config-local.js in this directory with the following
 * format:
 *module.exports = {
    settings: {
        db: 'mongodb://localhost/svmp_proxy_db',
        port: 8001,
        tls_proxy: false,
        vm_port: 5000,
        test_db: 'mongodb://localhost/proxy_testing_db',
        openstack: {"authUrl": "http://", 
                    "username": "test", 
                    "password": "test",
                    "tenantId": "eee",
                    "tenantName": "hello" },
        pam: {service: '', remotehost: ''}
    },
    // Video Information sent from Proxy to Client
    webrtc: {
        ice: { iceServer: [{url: 'stun1234'}]},
        video: { audio: true, video: { mandatory: {}, optional: []}},
        pc: {optional: [{DtlsSrtpKeyAgreement: true}]}
    }
};*/
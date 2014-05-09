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
    net = require('net'),
    framedSocket = require('../../lib/server/framedsocket');
    crypto = require('crypto')

/**
 * Measure messages per second between SVMPSocket client and server.
 *
 */
svmp.init();


var SID =  "12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890";
var SAMPLE = {
    type: 'AUTH',
    authRequest: {
        type: 'AUTHENTICATION',
        username: 'dave',
        sessionToken: SID,
        password: "blahblahblahblah",
        securityToken: "1234567890123456789012345678901234567890123456789012345678901234567890"
    }
};

var SAMPLE2 = {"type":"WEBRTC","webrtcMsg":{"json":"{\"type\":\"offer\",\"sdp\":\"v=0\\r\\no=- 1490859478639504698 2 IN IP4 127.0.0.1\\r\\ns=-\\r\\nt=0 0\\r\\na=group:BUNDLE audio video\\r\\na=msid-semantic: WMS\\r\\nm=audio 46030 RTP\\/SAVPF 103 111 9 102 0 8 106 105 13 127 126\\r\\nc=IN IP4 192.168.0.163\\r\\na=rtcp:46030 IN IP4 192.168.0.163\\r\\na=candidate:3808039560 1 udp 2122129151 192.168.0.163 46030 typ host generation 0\\r\\na=candidate:3808039560 2 udp 2122129151 192.168.0.163 46030 typ host generation 0\\r\\na=candidate:2893672056 1 tcp 1518149375 192.168.0.163 49144 typ host generation 0\\r\\na=candidate:2893672056 2 tcp 1518149375 192.168.0.163 49144 typ host generation 0\\r\\na=ice-ufrag:qy\\/VeQNfVL1EluCd\\r\\na=ice-pwd:rcxbQ8jVoNhfaBvG3ECEaYC5\\r\\na=ice-options:google-ice\\r\\na=fingerprint:sha-1 FE:0E:66:8C:69:AB:94:5D:03:CC:94:18:B7:71:A8:03:07:11:63:80\\r\\na=setup:actpass\\r\\na=mid:audio\\r\\na=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\\r\\na=extmap:3 http:\\/\\/www.webrtc.org\\/experiments\\/rtp-hdrext\\/abs-send-time\\r\\na=recvonly\\r\\na=rtcp-mux\\r\\na=rtpmap:103 ISAC\\/16000\\r\\na=rtpmap:111 opus\\/48000\\/2\\r\\na=fmtp:111 minptime=10\\r\\na=rtpmap:9 G722\\/16000\\r\\na=rtpmap:102 ILBC\\/8000\\r\\na=rtpmap:0 PCMU\\/8000\\r\\na=rtpmap:8 PCMA\\/8000\\r\\na=rtpmap:106 CN\\/32000\\r\\na=rtpmap:105 CN\\/16000\\r\\na=rtpmap:13 CN\\/8000\\r\\na=rtpmap:127 red\\/8000\\r\\na=rtpmap:126 telephone-event\\/8000\\r\\na=maxptime:60\\r\\nm=video 46030 RTP\\/SAVPF 100 116 117\\r\\nc=IN IP4 192.168.0.163\\r\\na=rtcp:46030 IN IP4 192.168.0.163\\r\\na=candidate:3808039560 1 udp 2122129151 192.168.0.163 46030 typ host generation 0\\r\\na=candidate:3808039560 2 udp 2122129151 192.168.0.163 46030 typ host generation 0\\r\\na=candidate:2893672056 1 tcp 1518149375 192.168.0.163 49144 typ host generation 0\\r\\na=candidate:2893672056 2 tcp 1518149375 192.168.0.163 49144 typ host generation 0\\r\\na=ice-ufrag:qy\\/VeQNfVL1EluCd\\r\\na=ice-pwd:rcxbQ8jVoNhfaBvG3ECEaYC5\\r\\na=ice-options:google-ice\\r\\na=fingerprint:sha-1 FE:0E:66:8C:69:AB:94:5D:03:CC:94:18:B7:71:A8:03:07:11:63:80\\r\\na=setup:actpass\\r\\na=mid:video\\r\\na=extmap:2 urn:ietf:params:rtp-hdrext:toffset\\r\\na=extmap:3 http:\\/\\/www.webrtc.org\\/experiments\\/rtp-hdrext\\/abs-send-time\\r\\na=recvonly\\r\\na=rtcp-mux\\r\\na=rtpmap:100 VP8\\/90000\\r\\na=rtcp-fb:100 ccm fir\\r\\na=rtcp-fb:100 nack\\r\\na=rtcp-fb:100 nack pli\\r\\na=rtcp-fb:100 goog-remb\\r\\na=rtpmap:116 red\\/90000\\r\\na=rtpmap:117 ulpfec\\/90000\\r\\n\"}"}}


var bufferRequest = svmp.protocol.writeRequest(SAMPLE2);



// Make sure to turn TLS off
svmp.config.set('settings:tls_proxy', false);

var
    port = svmp.config.get('settings:port'),
    client = framedSocket.wrap(new net.Socket());
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
    var r = svmp.protocol.parseRequest(msg);

    if(r.type === 'WEBRTC') {
        counter++;
    }
    //client.write(bufferRequest);
    client.write(bufferRequest.slice(0,1));
    client.write(bufferRequest.slice(1,100));
    client.write(bufferRequest.slice(100,1000));
    client.write(bufferRequest.slice(1000,bufferRequest.length));
});

client.on('connect', function () {
    client.write(bufferRequest);
    count();
    setTimeout(finish, totalTestTime);
});

// GO
client.connect(port);

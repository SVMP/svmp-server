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
    svmp = require('./../svmp'),
    nconf = require('nconf'),
    path = require('path'),
    jsvutil = require('jsvutil'),
    schema = require('../../config/schema'),
    fs = require('fs');


module.exports = nconf;

nconf.init = function () {
    var configFile = path.join(__dirname, '../../config/config-local.json');
    svmp.config
        .env()
        .file(configFile);

    // Validate config against schema
    jsvutil.validate(svmp.config.stores.file.store, schema, function (err, obj) {
        if (err) {
            svmp.logger.error(err.message);
            process.exit(1);
        } else {
            svmp.config.configTls();
        }
    });
};

nconf.isEnabled = function (key) {
    return svmp.config.get(key) === true;
};

nconf.isDisabled = function (key) {
    return svmp.config.get(key) === false;
};

nconf.useTlsCertAuth = function () {
    return svmp.config.get("settings:tls_proxy") && svmp.config.get("settings:use_tls_user_auth");
};

nconf.configTls = function () {
    if (svmp.config.isEnabled('settings:tls_proxy')) {
        var privateKeyName = svmp.config.get('settings:tls_private_key');
        var certFileName = svmp.config.get('settings:tls_certificate');
        var passPhrase = svmp.config.get('settings:tls_private_key_pass');

        var privateKeyFile = path.join(__dirname,'../../tls',privateKeyName);
        var certFile = path.join(__dirname,'../../tls',certFileName);

        var options = {};


        try {
            var tls_key = fs.readFileSync(privateKeyFile);
        } catch (err) {
            svmp.logger.error("Could not open TLS private key '%s' (check config.settings.tls_private_key)", privateKeyName);
            process.exit(1);
        }
        try {
            var tls_cert = fs.readFileSync(certFile);
        } catch (err) {
            svmp.logger.error("Could not open TLS certificate '%s' (check config.settings.tls_certificate)", certFileName);
            process.exit(1);
        }
        options.type = 'tls';
        options.key = tls_key;
        options.passphrase = passPhrase;
        options.cert = tls_cert;
        options.honorCipherOrder = true;
        options.ciphers =
            "AES128-SHA:" +                    // TLS_RSA_WITH_AES_128_CBC_SHA
            "AES256-SHA:" +                    // TLS_RSA_WITH_AES_256_CBC_SHA
            "AES128-SHA256:" +                 // TLS_RSA_WITH_AES_128_CBC_SHA256
            "AES256-SHA256:" +                 // TLS_RSA_WITH_AES_256_CBC_SHA256
            "ECDHE-RSA-AES128-SHA:" +          // TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA
            "ECDHE-RSA-AES256-SHA:" +          // TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA
            "DHE-RSA-AES128-SHA:" +            // TLS_DHE_RSA_WITH_AES_128_CBC_SHA, should use at least 2048-bit DH
            "DHE-RSA-AES256-SHA:" +            // TLS_DHE_RSA_WITH_AES_256_CBC_SHA, should use at least 2048-bit DH
            "DHE-RSA-AES128-SHA256:" +         // TLS_DHE_RSA_WITH_AES_128_CBC_SHA256, should use at least 2048-bit DH
            "DHE-RSA-AES256-SHA256:" +         // TLS_DHE_RSA_WITH_AES_256_CBC_SHA256, should use at least 2048-bit DH
            "ECDHE-ECDSA-AES128-SHA256:" +     // TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256, should use elliptic curve certificates
            "ECDHE-ECDSA-AES256-SHA384:" +     // TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA384, should use elliptic curve certificates
            "ECDHE-ECDSA-AES128-GCM-SHA256:" + // TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256, should use elliptic curve certificates
            "ECDHE-ECDSA-AES256-GCM-SHA384:" + // TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384, should use elliptic curve certificates
            "@STRENGTH";
        options.requestCert = false;

        if (svmp.config.isEnabled('settings:use_tls_user_auth')) {
            var filename = svmp.config.get('settings:tls_ca_cert');
            var cacertPath = path.join(__dirname,'../../tls',filename);

            try {
                options.ca = [ fs.readFileSync(cacertPath) ];
            } catch (err) {
                svmp.logger.error("Could not open TLS ca cert file '%s' (check config.settings.tls_ca_cert)", filename);
                process.exit(1);
            }

            options.requestCert = true;
        }

        svmp.config.set('tls_options', options);
    }
};

nconf.getVideoResponse = function() {
    // Stringify parameters
    var ice = JSON.stringify(svmp.config.get('settings:webrtc:ice'));
    var video = JSON.stringify(svmp.config.get('settings:webrtc:video'));
    var pc = JSON.stringify(svmp.config.get('settings:webrtc.pc'));

    return { iceServers: ice, pcConstraints: pc, videoConstraints: video };
};



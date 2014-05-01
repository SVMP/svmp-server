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
    jsvutil = require('jsvutil'),
    schema = require('../../config/schema'),
    fs = require('fs');


/**
 * Load Javascript configuration file.
 *
 * This code is adapted from the nconf project: https://github.com/flatiron/nconf
 *
 * @type {Configuration}
 */
var Configuration = exports.Configuration = function () {

    this.mtimes = {};
    var configFile = require('../../config/config-local');

    var that = this;

    // Validate config against schema
    jsvutil.validate(configFile, schema, function (err, obj) {
        if (err) {
            svmp.logger.error(err.message);
            process.exit(1);
        } else {
            that.store = obj;
            that.configTls();
        }
    });
};

/**
 * Look up path
 * @param key
 * @returns {Array}
 * @private
 */
Configuration.prototype._path = function (key) {
    return key == null ? [] : key.split(':');
};

/**
 * Get a value.
 * @param key
 * @returns {*}
 */
Configuration.prototype.get = function (key) {
    var target = this.store,
        path = this._path(key);
    //
    // Scope into the object to get the appropriate nested context
    //
    while (path.length > 0) {
        key = path.shift();
        if (target && target.hasOwnProperty(key)) {
            target = target[key];
            continue;
        }
        return undefined;
    }

    return target;
};

/**
 * Set a value
 * @param key
 * @param value
 * @returns {boolean}
 */
Configuration.prototype.set = function (key, value) {
    var target = this.store,
        path = this._path(key);

    if (path.length === 0) {
        //
        // Root must be an object
        //
        if (!value || typeof value !== 'object') {
            return false;
        }
        else {
            this.reset();
            this.store = value;
            return true;
        }
    }

    //
    // Update the `mtime` (modified time) of the key
    //
    this.mtimes[key] = Date.now();

    //
    // Scope into the object to get the appropriate nested context
    //
    while (path.length > 1) {
        key = path.shift();
        if (!target[key] || typeof target[key] !== 'object') {
            target[key] = {};
        }

        target = target[key];
    }

    // Set the specified value in the nested JSON structure
    key = path.shift();

    target[key] = value;
    return true;
};

/**
 * Clear the internal store
 * @param key
 * @returns {boolean}
 */
Configuration.prototype.clear = function (key) {

    var target = this.store,
        value = target,
        path = this._path(key);

    //
    // Remove the key from the set of `mtimes` (modified times)
    //
    delete this.mtimes[key];

    //
    // Scope into the object to get the appropriate nested context
    //
    for (var i = 0; i < path.length - 1; i++) {
        key = path[i];
        value = target[key];
        if (typeof value !== 'function' && typeof value !== 'object') {
            return false;
        }
        target = value;
    }

    // Delete the key from the nested JSON structure
    key = path[i];
    delete target[key];
    return true;
};

/**
 * Reset internal store
 * @returns {boolean}
 */
Configuration.prototype.reset = function () {
    this.mtimes = {};
    this.store = {};
    return true;
};

/**
 * Is the given key enabled (true or false?)
 * @param key
 * @returns {boolean}
 */
Configuration.prototype.isEnabled = function (key) {
    return this.get(key) === true;
};

/**
 * Is the given key disabled?
 * @param key
 * @returns {boolean}
 */
Configuration.prototype.isDisabled = function (key) {
    return this.get(key) === false;
};

/**
 * Use TLS certification authentication?
 * @returns {*}
 */
Configuration.prototype.useTlsCertAuth = function () {
    return this.get("settings:tls_proxy") && this.get("settings:use_tls_user_auth");
};

/**
 * Configure this TLS information.
 */
Configuration.prototype.configTls = function () {
    if (this.isEnabled('settings:tls_proxy')) {
        var privateKeyPath = this.get('settings:tls_private_key');
        var certFilePath = this.get('settings:tls_certificate');
        var passPhrase = this.get('settings:tls_private_key_pass');

        var options = {};


        try {
            var tls_key = fs.readFileSync(privateKeyPath);
        } catch (err) {
            svmp.logger.error("Could not open TLS private key '%s' (check config.settings.tls_private_key)", privateKeyPath);
            process.exit(1);
        }
        try {
            var tls_cert = fs.readFileSync(certFilePath);
        } catch (err) {
            svmp.logger.error("Could not open TLS certificate '%s' (check config.settings.tls_certificate)", certFilePath);
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

        if (this.isEnabled('settings:use_tls_user_auth')) {
            var cacertPath = this.get('settings:tls_ca_cert');

            try {
                options.ca = [ fs.readFileSync(cacertPath) ];
            } catch (err) {
                svmp.logger.error("Could not open TLS ca cert file '%s' (check config.settings.tls_ca_cert)", cacertPath);
                process.exit(1);
            }

            options.requestCert = true;
        }

        this.set('tls_options', options);
    }
};




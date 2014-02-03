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
 * author Joe Portner
 *
 */

/**
 * Expects a file named config-local.js in this directory
 * (see config-local.js.example)
*/

var jsvutil = require('jsvutil'),
    config = require('./config-local'),
    schema = require('./schema'),
    winston = require('winston');

// this must be called once in the process before accessing the "global.config" object
// if this fails, an error message prints and the process exits
exports.tryValidate = function() {
    // first, validate our config file against the schema and apply default values
    jsvutil.validate(config, schema, function (err, obj) {
        if (err) {
            winston.error(err.message);
            process.exit(1);
        } else {
            // assign a global variable to the validated config object with default values applied
            global.config = obj;
        }
    });
};

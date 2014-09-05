/*
 * Copyright 2013-2014 The MITRE Corporation, All Rights Reserved.
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

module.exports = {
    "required": true,
    "type": "object",
    "properties": {
        "port": {
            "minimum": 1,
            "maximum": 65535,
            "type": "number"
        },
        // authentication options
        "cert_user_auth": {
            "type": "boolean"
        },
        "behind_reverse_proxy": {
            "type": "boolean"
        },
        // ssl options
        "enable_ssl": {
            "type": "boolean"
        },
        "server_certificate": {
            "type": "string"
        },
        "private_key": {
            "type": "string"
        },
        "private_key_pass": {
            "type": "string"
        },
        "ca_cert": {
            "type": "string"
        },
        // overseer settings
        "overseer_cert": {
            "required": true,
            "type": "string"
        },
        "auth_token": {
            "required": true,
            "type": "string"
        },
        // logging options
        "log_file": {
            "required": true,
            "type": "string"
        },
        "log_level": {
            "enum": ["silly", "debug", "verbose", "info", "warn", "error"],
            "type": "string"
        },
        "log_request_filter": {
            "type": "array"
        },
        // webrtc options
        "webrtc": {
            "required": true,
            "type": "object",
            "properties": {
                "ice_servers": {
                    "required": true,
                    "minItems": 0,
                    "type": "array",
                    "items": {
                        "required": true,
                        "type": "object",
                        "properties": {
                            "url": {
                                "required": true,
                                // TODO: add pattern validation for stun:host:port URL
                                "type": "string"
                            },
                            "username": {
                                "type": "string"
                            },
                            "password": {
                                "type": "string"
                            }
                        }
                    }
                },
                "pc": {
                    "type": "object",
                },
                "video": {
                    "type": "object",
                }
            }
        }
    }
};

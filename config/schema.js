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
    "$schema": "http://json-schema.org/draft-03/schema",
    "required": true,
    "type": "object",
    "properties": {
        "settings": {
            "required": true,
            "type": "object",
            "properties": {
                "port": {
                    "default": 8080,
                    "minimum": 1,
                    "maximum": 65535,
                    "type": "number"
                },
                "tls_proxy": {
                    "default": false,
                    "type": "boolean"
                },
                "reverse_proxied": {
                    "default": false,
                    "type": "boolean"
                },
                "tls_certificate": {
                    "default": "",
                    "type": "string"
                },
                "tls_private_key": {
                    "default": "",
                    "type": "string"
                },
                "tls_private_key_pass": {
                    "default": "",
                    "type": "string"
                },
                "use_tls_user_auth": {
                    "default": false,
                    "type": "boolean"
                },
                "tls_ca_cert": {
                    "default": "",
                    "type": "string"
                },
                "rest_api_host": {
                    "required": true,
                    "type": "string"
                },
                "rest_api_port": {
                    "default": 3000,
                    "minimum": 1,
                    "maximum": 65535,
                    "type": "number"
                },
                "token_secret": {
                    "required": true,
                    "type": "string"
                },
                "svmp_auth_token": {
                    "required": true,
                    "type": "string"
                },
                "max_session_length": {
                    "default": 21600,
                    "type": "number"
                },
                "session_check_interval": {
                    "default": 60,
                    "type": "number"
                },
                "vm_idle_ttl": {
                    "default": 3600,
                    "type": "number"
                },
                "vm_check_interval": {
                    "default": 300,
                    "type": "number"
                },
                "log_file": {
                    "default": "proxy_log.txt",
                    "type": "string"
                },
                "log_level": {
                    "default": "info",
                    "enum": ["silly", "debug", "verbose", "info", "warn", "error"],
                    "type": "string"
                },
                "log_request_filter": {
                    "default": ["SENSOREVENT", "TOUCHEVENT"],
                    "type": "array"
                },
            }
        },
        "webrtc": {
            "required": true,
            "type": "object",
            "properties": {
                "ice": {
                    "required": true,
                    "type": "object",
                    "properties": {
                        "iceServers": {
                            "required": true,
                            "minItems": 1,
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
                        }
                    }
                },
                "pc": {
                    "default": {
                        optional: [
                            {
                                DtlsSrtpKeyAgreement: true
                            }
                        ]
                    },
                    "type": "object",
                    "properties": {
                        "optional": {
                            "required": true,
                            "minItems": 1,
                            "type": "array",
                            "items": {
                                "required": true,
                                "type": "object",
                                "properties": {
                                    "DtlsSrtpKeyAgreement": {
                                        "required": true,
                                        "type": "boolean"
                                    }
                                }
                            }
                        }
                    }
                },
                "video": {
                    "default": {
                        audio: true,
                        video: {
                            mandatory: {},
                            optional: []
                        }
                    },
                    "type": "object",
                    "properties": {
                        "audio": {
                            "required": true,
                            "type": "boolean"
                        },
                        "video": {
                            "required": true,
                            "type": "object",
                            "properties": {
                                "mandatory": {
                                    "required": true,
                                    "type": "object"
                                },
                                "optional": {
                                    "required": true,
                                    "type": "array"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

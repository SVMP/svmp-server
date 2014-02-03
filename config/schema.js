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

module.exports = {
    "$schema" : "http://json-schema.org/draft-03/schema",
    "required" : true,
    "type" : "object",
    "properties" : {
        "settings" : {
            "required" : true,
            "type" : "object",
            "properties" : {
                "db" : {
                    "default" : "mongodb://localhost/svmp_proxy_db",
                    // TODO: add pattern validation for db
                    "type" : "string"
                },
                "port" : {
                    "default" : 8002,
                    "minimum" : 1,
                    "maximum" : 65535,
                    "type" : "number"
                },
                "vm_port" : {
                    "default" : 8001,
                    "minimum" : 1,
                    "maximum" : 65535,
                    "type" : "number"
                },
                "tls_proxy" : {
                    "default" : false,
                    "type" : "boolean"
                },
                "tls_certificate" : {
                    "default" : "",
                    "type" : "string"
                },
                "tls_private_key" : {
                    "default" : "",
                    "type" : "string"
                },
                "max_session_length" : {
                    "default" : 21600,
                    "type" : "number"
                },
                "session_token_ttl" : {
                    "default" : 300,
                    "type" : "number"
                },
                "session_check_interval" : {
                    "default" : 60,
                    "type" : "number"
                },
                "use_pam" : {
                    "default" : false,
                    "type" : "boolean"
                },
                "pam_service" : {
                    "default" : "svmp",
                    "type" : "string"
                },
                "sendmail" : {
                    "default" : false,
                    "type" : "boolean"
                },
                "smtp" : {
                    "type" : "string"
                },
                "admincontact" : {
                    // TODO: add pattern validation for admincontact email address
                    "type" : "string"
                },
                "log_file" : {
                    "default" : "proxy_log.txt",
                    "type" : "string"
                },
                "openstack" : {
                    "required" : true,
                    "type" : "object",
                    "properties" : {
                        "authUrl" : {
                            "required" : true,
                            // TODO: add pattern validation for authUrl
                            "type" : "string"
                        },
                        "password" : {
                            "required" : true,
                            "type" : "string"
                        },
                        "tenantId" : {
                            "required" : true,
                            "type" : "string"
                        },
                        "tenantName" : {
                            "required" : true,
                            "type" : "string"
                        },
                        "username" : {
                            "required" : true,
                            "type" : "string"
                        }
                    }
                }
            }
        },
        "webrtc" : {
            "required" : true,
            "type" : "object",
            "properties" : {
                "ice" : {
                    "required" : true,
                    "type" : "object",
                    "properties" : {
                        "iceServers" : {
                            "required" : true,
                            "minItems" : 1,
                            "type" : "array",
                            "items" : {
                                "required" : true,
                                "type" : "object",
                                "properties" : {
                                    "url" : {
                                        "required" : true,
                                        // TODO: add pattern validation for stun:host:port URL
                                        "type" : "string"
                                    }
                                }
                            }
                        }
                    }
                },
                "pc" : {
                    "default" : {
                        optional : [{
                                DtlsSrtpKeyAgreement : true
                            }
                        ]
                    },
                    "type" : "object",
                    "properties" : {
                        "optional" : {
                            "required" : true,
                            "minItems" : 1,
                            "type" : "array",
                            "items" : {
                                "required" : true,
                                "type" : "object",
                                "properties" : {
                                    "DtlsSrtpKeyAgreement" : {
                                        "required" : true,
                                        "type" : "boolean"
                                    }
                                }
                            }
                        }
                    }
                },
                "video" : {
                    "default" : {
                        audio : true,
                        video : {
                            mandatory : {},
                            optional : []
                        }
                    },
                    "type" : "object",
                    "properties" : {
                        "audio" : {
                            "required" : true,
                            "type" : "boolean"
                        },
                        "video" : {
                            "required" : true,
                            "type" : "object",
                            "properties" : {
                                "mandatory" : {
                                    "required" : true,
                                    "type" : "object"
                                },
                                "optional" : {
                                    "required" : true,
                                    "type" : "array"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

Author: Joe Portner

This file describes the various configuration values that are available for the server
Any values that are optional have defaults that they use if they are not specified (see config/schema.js)

NAME                    TYPE       REQUIRED    DESCRIPTION
========================================================================================================================
port                    integer    optional    External TCP port to listen on for client connections
vm_port                 integer    optional    Port to connect to on Android VMs
revserse_proxied        boolean    optional    Whether or not the server is behind a reverse proxy
tls_proxy               boolean    optional    Enables or disables TLS encryption
tls_certificate         string     optional    Path to TLS certificate file (needed if tls_proxy=true)
tls_private_key         string     optional    Path to TLS private key file (needed if tls_proxy=true)
tls_private_key_pass    string     optional    Password to TLS private key file (needed if tls_proxy=true)
use_tls_user_auth       boolean    optional    Enables or disables TLS certificate user authentication
                                               (requires tls_proxy=true or reverse_proxied=true)
tls_ca_cert             string     optional    Path to TLS CA Cert to validate user certs against
                                               (needed if use_tls_user_auth=true)
token_secret            string     required    Secret key used to validate login tokens (shared with login server)
max_session_length      integer    optional    Maximum length of a client session (in seconds) before it is forcibly
                                               disconnected
session_check_interval  integer    optional    Interval (in seconds) of time to check for expired sessions, this is used
                                               while a connection is active
vm_idle_ttl             integer    optional    Maximum life span of an idle VM (in seconds) before it is expired and
                                               gets destroyed, this is used after a session is disconnected; an idle VM
                                               is expired when this or 'max_session_length' is reached
vm_check_interval       integer    optional    Interval (in seconds) of time to check for expired VMs, this is used in
                                               the background

log_file                string     optional    Log file path
log_level               string     optional    Log level to use, omits lower log levels, lowest to highest: silly,
                                               debug, verbose, info, warn, error
log_request_filter      array      optional    Protobuf request messages to filter out when using verbose logging

webrtc                  object     required    Video Information sent from Proxy to Client

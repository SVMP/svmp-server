/**
 * Example configuration file
 */
module.exports = {
    settings: {
        // External TCP port to listen on for client connections.
        // default = 8002
        port: 8002,

        // Enable SSL
        // default = false
        tls_proxy: true,

        // Are we operating behind a reverse proxy?
        // default = false
        reverse_proxied: false,

        // SSL certificate and private key paths
        // (required if tls_proxy == true)
        tls_certificate: 'out/server_cert.pem',
        tls_private_key: 'out/server_pkey.pem',

        // SSL private key password
        // (if the server private key file is password protected)
        tls_private_key_pass: '',

        // Use TLS client authentication
        // default = false
        use_tls_user_auth: false,

        // TLS CA Cert to validate user certs against
        // only used if use_tls_user_auth == true
        tls_ca_cert: 'out/ca_cert.pem',

        // Address of the SVMP REST API that we use to facilitate user VM setup.
        rest_api_host: 'svmp-login.example.com',

        // Port of the SVMP REST API.
        rest_api_port: 3000,

        // Auth token verification string. A shared secret between the proxy and
        // login servers.
        token_secret: 'a long secret string',

        // JSON web token to authenticate to the login server as an admin user.
        svmp_auth_token: '0123456789abcdef',

        // Maximum length of a client session (in seconds) before it is
        // forcibly disconnected.
        // default = 21600 [6 hours]
        max_session_length: 21600,

        // Interval (in seconds) of time to check for expired sessions.
        // This is used while a connection is active.
        // default = 60 [1 minute]
        session_check_interval: 60,

        // Maximum life span of an idle VM (in seconds) before it is expired and gets destroyed.
        // This is used after a session is disconnected.
        // default = 3600 [1 hour]
        vm_idle_ttl: 3600,

        // Interval (in seconds) of time to check for expired VMs.
        // This is used after a session is disconnected.
        // default = 300 [5 minutes]
        vm_check_interval: 300,

        // Log file path
        // default = 'proxy_log.txt'
        log_file: 'proxy_log.txt',

        // Log level to use, omits lower log levels
        // Levels, lowest to highest: silly, debug, verbose, info, warn, error
        // default = 'info'
        log_level: 'info',

        // Protobuf request messages to filter out when using verbose logging
        // default = ['SENSOREVENT', 'TOUCHEVENT']
        log_request_filter: ['SENSOREVENT', 'TOUCHEVENT'],

    },
    // Video Information sent from Proxy to Client
    webrtc: {
        "ice": {
            // Enter one or more servers to use for ICE NAT traversal
            "iceServers": [
                // Ex1: Unauthenticated STUN server
                {
                    "url": "stun:<stun server ip>:3478"
                },
                // Ex2: Password protected STUN server
                {
                    "url": "stun:<stun server ip>:3478",
                    "password": "stun-credential"
                },
                // Ex3: TURN relay server (username & password required)
                {
                    "url": "turn:<turn server ip>:3478",
                    "username": "turn-user",
                    "password": "turn-password"
                }
            ]
        },
        // WebRTC constraints and paramenters that are sent to the peers.
        // Don't change unless you know what you're doing.
        video: { audio: true, video: { mandatory: {}, optional: []}},
        pc: {optional: [
            {DtlsSrtpKeyAgreement: true}
        ]}
    }
};

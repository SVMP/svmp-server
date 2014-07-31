/**
 * Example configuration file
 */
module.exports = {
    settings: {
        // MongoDB database url
        db: {
            production: "mongodb://localhost/svmp_proxy_db",
            test: "mongodb://localhost/svmp_proxy_db_test"
        },

        // External TCP port to listen on for client connections.
        // default = 8002
        port: 8002,

        // Port to connect to on Android VMs
        // default = 8001
        vm_port: 8001,

        // Enable SSL
        // default = false
        tls_proxy: true,

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

        // Maximum length of a client session (in seconds) before it is
        // forcibly disconnected.
        // default = 21600 [6 hours]
        max_session_length: 21600,

        // Validity time of session tokens in seconds.
        // Allows client to reconnect a disconnected session by providing
        // the token instead of doing a full re-authentication.
        // default = 300 [5 minutes]
        session_token_ttl: 300,

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

        // Use PAM authentication
        // default = false
        use_pam: false,

        // PAM 'service' name to use. I.e., which file under /etc/pam.d/
        // default = 'svmp'
        pam_service: 'svmp',

        // Web Console
        // Enable email functionality for the web console
        // default = false
        sendmail: false,
        // SMTP server, username, and password
        // TODO: what format?
        smtp: '',
        // Admin email address
        admincontact: '',

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

        // What cloud platform to use for launching VMs
        // Valid values: openstack, aws
        cloud_platform: "openstack",

        // Openstack cloud connection details
        openstack: {
            // only required if 'cloud_platform' is set to 'openstack'
            "authUrl": "http://localhost:5000/",
            "username": "test",
            "password": "test",
            "tenantId": "0123456789abcdef0123456789abcdef",
            "tenantName": "test",
            "region": "RegionOne"
        },

        // Amazon Web Services cloud connection details
        aws: {
            // only required if 'cloud_platform' is set to 'aws'
            "accessKeyId": "",
            "secretAccessKey": "",
            "region": "us-east-1",
            "availabilityZone": "us-east-1a"
        },

        // VM/Volume defaults
        // images: a map of device types to their respective image ids on the cloud server.
        // vmflavor: the value (as a string) of the VM flavor. For AWS, this is the instance type.
        //   OpenStack flavors must be a number, example: m1.tiny = '1', m1.small = '2'
        //   AWS instance types must be a string, example: 't1.micro', 'm1.small'
        //   Run 'bin/cli.js images' for a listing.
        // goldsnapshotId: the snapshot id to use for new volumes
        // goldsnapshotSize: only used for OpenStack; the integer size in GBs, SAME AS THE goldsnapshot SIZE.
        // use_floating_ip: only used for OpenStack; if this is enabled, we assign a floating IP address to the VM when
        //   we start it. This is necessary if the proxy server isn't running within Openstack itself.
        // floating_ip_pool: only used for OpenStack; if use_floating_ip is enabled, this can be optionally specified to
        //   tell Openstack what ip pool to use when allocating new addresses
        // pollintervalforstartup: this is the interval in milliseconds the apis to check for a running VM

        new_vm_defaults: {
            "images": {
                // Mapping of cloud image ID to a friendly name. These are the names used by the
                // configuration tool's add-user command.
                // each device type should have its own name and image ID in key/value format, e.g.:
                // "device_type": "imageID",
            },
            vmflavor: "1",
            goldsnapshotId: "",
            goldsnapshotSize: 6,
            use_floating_ips: false,
            floating_ip_pool: "nova",
            pollintervalforstartup: 2000
        }
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

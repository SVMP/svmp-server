module.exports = {
    port: 8080,
    enable_ssl: false,
    server_certificate: "",
    private_key: "",
    private_key_pass: "",
    ca_cert: "",
    cert_user_auth: false,
    behind_reverse_proxy: false,
    log_level: 'info',
    log_request_filter: ['SENSOREVENT', 'TOUCHEVENT'],
    webrtc: {
        iceServes: {},
        video: { audio: true, video: { mandatory: {}, optional: [] } },
        pc: { optional: [ {DtlsSrtpKeyAgreement: true} ] }
    }
};

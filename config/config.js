'use strict';

module.exports = {
    development: {
        db: 'mongodb://localhost/svmp_dev',
        port: 8001,
        admin_port: 8005,
        admin_root: require('path').normalize(__dirname + '/..')
    },
    production: {
        db: 'mongodb://localhost/svmp_production',
        port: 8001,
        admin_port: 8005,
        admin_root: require('path').normalize(__dirname + '/..')
    }
};
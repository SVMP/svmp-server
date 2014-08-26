# Node SVMP Proxy

Serves as a basic TCP proxy between Android devices and Android VMs running in the cloud. Handles authentication, session management, and proxying messages.

[![Build Status](https://travis-ci.org/SVMP/svmp-server.svg?branch=master)](https://travis-ci.org/SVMP/svmp-server)

## Setup

### Prerequisites
* Install [Node.js](http://nodejs.org)

#### Windows only
* Install [Git for Windows](http://msysgit.github.io/)
* Install [Python 2.7.6](https://www.python.org/download/releases/2.7.6/)

Additionally, on Windows, do the following *in order:*

* Install [Visual Studio 2010](http://www.microsoft.com/visualstudio/eng/downloads#d-2010-express)
* Install [Windows SDK 7.1](http://www.microsoft.com/en-us/download/details.aspx?id=8279)
* Install [Visual Studio 2010 SP1](http://www.microsoft.com/en-us/download/details.aspx?id=23691)
* Install [Visual C++ 2010 SP1 Compiler Update for the Windows SDK 7.1](http://www.microsoft.com/en-us/download/details.aspx?id=4422)

### Install Steps
1. Download this project
2. Within the root directory of this project, run this command to install the project and download dependencies:
```sh
$ npm install
```

### Configuration

1. Within the root directory of this project, run this command to create a new config file using the template:
```sh
$ npm run test-config
```

2. Review the various fields in *config/config-local.js* and set them to match your configuration
3. Make sure to add your SVMP Overseer information in `svmp_overseer_host`, `svmp_overseer_port`, and `svmp_overseer_cert`.

#### Enable TLS

If you don't have your own CA and you want to use TLS, follow these steps to generate a CA certificate, server certificate, and server private key:

1. Make sure you have the Java JDK installed
2. Open the *tls/Makefile* script and change the preset password for the server key:
```
SERVER_PASSPHRASE := changeme_password
```

3. Open the *tls/ca.cnf* and *tls/server.cnf* files and configure them to your liking
4. Run the script from the root directory of the project to generate certificates in the *tls* directory:
```sh
$ make -C tls/
```

5. In *config/config-local.js*, set the `tls_certificate`, `tls_private_key`, and `tls_private_key_pass` values to match your server certificate, private key, and password

### Running the Proxy Server

1. Start MongoDB
2. Start the proxy:
```sh
$ node bin/server.js
```

### Adding Users and VMs

* Run the commandline client from the root directory of the project:
```sh
$ node bin/cli.js -h
```

    Run the help command to see a list of all commands

### Running Grunt unit tests

* Install Grunt's command line interface globally, then execute the Grunt task runner
```sh
$ npm install -g grunt-cli
$ grunt
```

## License

Copyright (c) 2012-2014, The MITRE Corporation, All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

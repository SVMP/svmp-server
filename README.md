# Node SVMP Proxy

Serves as a basic TCP proxy between Android devices and Android VMs running in the cloud. Handles authentication, session management, and proxying messages.

[![Build Status](https://travis-ci.org/SVMP/svmp-server.svg?branch=master)](https://travis-ci.org/SVMP/svmp-server)

## Setup

### Prerequisites
* Install [Node.js](http://nodejs.org) 0.10.x

### Install Steps

1. Download the project code
```sh
$ git clone https://github.com/SVMP/svmp-server
```
2. Within the root directory of this project, run this command to install the project and download dependencies:
```sh
$ npm install
```

### Configuration

1. Make a copy of the config file template from `config/_config.local.template.yaml` to either `config/config-local.yaml` or another location of your choosing. If you choose a custom location, make sure to use the `--config` option when running the server.
2. Review the various fields in *config/config-local.js* and set them to match your configuration based on the descriptions in the comments.
3. Make sure to add your SVMP Overseer information in `svmp_overseer_host`, `svmp_overseer_port`, and `svmp_overseer_cert`.

### Running the Proxy Server

1. Ensure the [SVMP Overseer](https://github.com/SVMP/svmp-overseer) is installed and running
2. Start the proxy:
```sh
$ node bin/server.js [--config=<path to config file>]
```

### Running Unit Tests

* Install Grunt's command line interface globally, then execute the Grunt task runner
```sh
$ npm install -g grunt-cli
$ npm test
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

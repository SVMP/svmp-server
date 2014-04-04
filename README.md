# Node SVMP Proxy

Serves as a basic TCP proxy between Android devices and Android VMs running in the cloud. Handles authentication, session management, and proxying messages.

## Setup

### Prerequisites
* Install [Node.js](http://nodejs.org)
* Install [MongoDB](http://docs.mongodb.org/manual/installation/) 2.2 or newer

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

        $ npm install

### Configuration

1. Create a file named *config/config-local.json* using *config/config-local-example.json.example* as a template. (we need to
document the setting separately - no comments allowed in json)
2. Review the various fields in *config/config-local.json* and set them to match your configuration

#### Enable TLS

If you don't have your own CA and you want to use TLS, follow these steps to generate a CA certificate, server certificate, and server private key:

1. Make sure you have the Java JDK installed
2. Open the *utils/generate_tls.sh* script and change the preset passwords for the CA, server, and client keys:

        # Change these variables
        CA_PKEY_PASS="changeme_cakeypass"
        SERVER_PKEY_PASS="changeme_serverkeypass"
        CLIENT_PKEY_PASS="changeme_clientkeypass"

3. Open the *tls/ca.cnf*, *tls/server.cnf*, and *tls/client.cnf* files  and configure them to your liking
4. Run the script from the root directory of the project to generate certificates in the *out* directory:

        $ ./utils/generate_tls.sh

5. In *config/config-local.js*, set the `tls_certificate`, `tls_private_key`, and `tls_private_key_pass` values to match your server certificate, private key, and password

#### Using client certificate authentication
If you want to use client certificate authentication, follow the **Enable TLS** instructions, then:

1. In *config/config-local.js*, set the `tls_ca_cert` value to match your CA certificate, and set the `use_tls_user_auth` value to *true*
2. Copy the client certificate *.p12* file to your device (Note: Android 4.0+ required)
3. To install the client certificate, open the SVMP client, create a new connection, choose an *Auth Type* of *Certificate*, touch the *Certificate* button, and use the KeyChain system to install the certificate

#### Using OpenStack
To connect your server to OpenStack:

1. In your config file, set the appropriate connection details within the `openstack` option.
2. Currently, to support different screen sizes and resolutions, each device type that is used with the server should be paired with its own image. In your config file, add device types and their matching image IDs in key/value format in `new_vm_defaults` : `images`.
3. Other VM-related settings in `new_vm_defaults` should also be adjusted to match your setup.

#### Managing sessions
After a client authenticates, they receive a session token. There are three config options for managing sessions:

* `max_session_length` - How long before a session expires. Clients with expired sessions get disconnected and require re-authentication.
* `session_token_ttl` - The grace period in which a client can use a session token to reconnect to the server without re-authenticating.
* `session_check_interval` - How often the server checks active sessions to see if they are expired.

#### Managing VM lifespans
If a client connects and they don't already have a VM running, the server will create one on the fly. When a user disconnects, their VM becomes idle; after being idle for too long, a VM becomes expired and gets destroyed. There are two config options for managing VM lifespans:

* `vm_idle_ttl` - How long before an idle VM is considered expired.
* `vm_check_interval` - How often the server checks idle VMs to see if they are expired.

### Running the Proxy Server

1. Start MongoDB
2. Start the proxy:

        $ node server.js

### Adding Users and VMs

* Run the commandline client from the root directory of the project:

        $ ./bin/spm -h

    Run the help command to see a list of all commands

## License

Copyright (c) 2012-2013, The MITRE Corporation, All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

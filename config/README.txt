Author: Joe Portner

This file describes the various configuration values that are available for the server
Any values that are optional have defaults that they use if they are not specified (see config/schema.js)

NAME                    TYPE       REQUIRED    DESCRIPTION
========================================================================================================================
db                      string     required    MongoDB database url
port                    integer    optional    External TCP port to listen on for client connections
vm_port                 integer    optional    Port to connect to on Android VMs
tls_proxy               boolean    optional    Enables or disables TLS encryption
tls_certificate         string     optional    Path to TLS certificate file (needed if tls_proxy=true)
tls_private_key         string     optional    Path to TLS private key file (needed if tls_proxy=true)
tls_private_key_pass    string     optional    Password to TLS private key file (needed if tls_proxy=true)
use_tls_user_auth       boolean    optional    Enables or disables TLS certificate user authentication
                                               (requires tls_proxy=true)
tls_ca_cert             string     optional    Path to TLS CA Cert to validate user certs against
                                               (needed if use_tls_user_auth=true)
max_session_length      integer    optional    Maximum length of a client session (in seconds) before it is forcibly
                                               disconnected
session_token_ttl       integer    optional    Validity time of session tokens (in seconds), allows client to reconnect
                                               a disconnected session by providing the token instead of doing a full
                                               re-authentication
session_check_interval  integer    optional    Interval (in seconds) of time to check for expired sessions, this is used
                                               while a connection is active
vm_idle_ttl             integer    optional    Maximum life span of an idle VM (in seconds) before it is expired and
                                               gets destroyed, this is used after a session is disconnected; an idle VM
                                               is expired when this or 'max_session_length' is reached
vm_check_interval       integer    optional    Interval (in seconds) of time to check for expired VMs, this is used in
                                               the background
use_pam                 boolean    optional    Enables or disables PAM authentication
pam_service             string     optional    PAM 'service' name to use, i.e. which file under /etc/pam.d/
                                               (needed if use_pam=true)
sendmail                boolean    optional    Enables or disables email functionality for the web console
smtp                    string     optional    SMTP server credentials, username/password (needed if sendmail=true)
admincontact            string     optional    Admin email address (needed if sendmail=true)

log_file                string     optional    Log file path
log_level               string     optional    Log level to use, omits lower log levels, lowest to highest: silly,
                                               debug, verbose, info, warn, error
log_request_filter      array      optional    Protobuf request messages to filter out when using verbose logging

openstack               object     required    OpenStack cloud connection details
------------------------------------------------------------------------------------------------------------------------
authUrl                 string     required    URL and port of your OpenStack service API
username                string     required    Username for your OpenStack service
password                string     required    Password for your OpenStack service
tenantId                string     required    Tenant ID for your OpenStack service
tenantName              string     required    Tenant name for your OpenStack service
region                  string     required    Region name for your OpenStack service
------------------------------------------------------------------------------------------------------------------------

new_vm_defaults         object     required    VM and volume defaults for OpenStack
------------------------------------------------------------------------------------------------------------------------
images                  object     required    Contains string key/value pairs for device types and their respective
                                               OpenStack image IDs; for each type of device that you support, you should
                                               make a new image, upload that image to OpenStack, and record the imageID
                                               Ex:    images: { "nexus_s": "7d532f18-88ed-489b-8b7a-9dfb72f0c8f4",
                                                                "nexus_7": "f69f5e06-2c6c-4bc4-848d-05464f18c413" }
vmflavor                string     required    The OpenStack VM flavor to use; note, MUST be a number, cannot be a GUID
use_floating_ips        boolean    required    Enables or disables the use of floating IP addresses for VMs
floating_ip_pool        string     optional    Name of the IP pool to use for floating IPs
                                               (needed if use_floating_ips=true)
goldsnapshotId          string     required    OpenStack snapshot ID (GUID) to use for new user volumes
goldsnapshotSize        integer    required    Size of user volumes (in gigabytes), THIS SHOULD BE SAME AS THE
                                               goldsnapshot SIZE
pollintervalforstartup  integer    required    Interval (in milliseconds) to use the API to check for a running VM
------------------------------------------------------------------------------------------------------------------------

webrtc                  object     required    Video Information sent from Proxy to Client

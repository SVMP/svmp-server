/*
 * Copyright 2013-2014 The MITRE Corporation, All Rights Reserved.
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
 * @author Dave Bryson
 *
 */

var
    PkgCloud = require('pkgcloud'),
    Q = require('q'),
    svmp = require('./../svmp');

var openstack = exports;

openstack.init = function () {
    var openstackInfo = svmp.config.get('settings:openstack');
    if (!openstackInfo) {
        svmp.logger.error("Failed to initialize OpenStack: cloud_platform set to 'openstack', but no OpenStack config (settings:openstack) found!");
        process.exit(1);
    }

    this.computeClient = PkgCloud.providers.openstack.compute.createClient(openstackInfo);
    this.blockClient = PkgCloud.providers.openstack.blockstorage.createClient(openstackInfo);
};

/**
 * @param userSessionObj {user, session} where: user: {} and session: {}
 * @returns {adapter.deferred.promise|*|promise|Q.promise}
 */
openstack.setUpUser = function (userSessionObj) {
    var deferred = Q.defer();
    var flvr = svmp.config.get('settings:new_vm_defaults:vmflavor');
    var user = userSessionObj.user;
    var img = svmp.config.get('settings:new_vm_defaults:images')[user.device_type];

    // if the user's VM already exists, just resolve it
    if (user.vm_ip && user.vm_ip.length > 0) {
        deferred.resolve(userSessionObj);
    }
    else {
        openstack.createAndStartVM(user, img, flvr)
            .then(openstack.attachVolumeToVMForUser)
            .then(openstack.assignFloatingIpToVM)
            // once the VM is set up, restart it so it will mount the volume correctly
            .then(openstack.restartVM)
            // after creating the VM and completing all sub-tasks, save user info in the model
            .then(svmp.users.updateUser)
            .then(function (updatedUser) {
                deferred.resolve({session: userSessionObj.session, user: updatedUser});
            }, function (err) {
                deferred.reject(new Error("VM setup failed: " + err.message));
            });
    }

    return deferred.promise;
};


/**
 * Get all the flavors available in Openstack
 * @param callback
 */
openstack.getFlavors = function (callback) {
    openstack.computeClient.getFlavors(function (err, flavors) {
        var list = [];
        if (err) {
            callback(err);
        } else {
            flavors.forEach(function (v, i, d) {
                list.push({_id: v.id, name: v.name});
            });
            callback(undefined, list);
        }
    });
};

/**
 * Return a list of VM image information
 * @param callback
 */
openstack.getImages = function (callback) {
    openstack.computeClient.getImages(function (err, images) {
        var list = [];
        if (err) {
            callback(err);
        } else {
            images.forEach(function (v, i, d) {
                list.push({_id: v.id, name: v.name});
            });
            callback(undefined, list);
        }
    });
};

/**
 * Create and Start a VM
 *
 * @param user the User object
 * @param image image ID
 * @param flavor image flavor number
 * @returns {adapter.deferred.promise|*|promise|Q.promise}
 */
openstack.createAndStartVM = function (user, image, flavor) {
    var deferred = Q.defer();
    var vmObj = {
        name: "svmp-user-instance_" + user.username + "-" + new Date().getTime(),
        flavor: flavor,
        image: image
    };
    openstack.computeClient.createServer(vmObj, function (err, server) {
        var poll = svmp.config.get('settings:new_vm_defaults:pollintervalforstartup');

        if (err) {
            deferred.reject(new Error("createAndStartVM failed, couldn't create server: " + err.message));
        } else {
            server.setWait({status: server.STATUS.running}, poll, function (err) {
                if (err) {
                    destroyAndReject(server.id, deferred, "createAndStartVM failed, waiting for startup", err);
                } else {
                    user.vm_id = server.id;
                    // if we aren't going to use a floating IP, then use the fixed IP that was returned
                    if (svmp.config.isEnabled('settings:new_vm_defaults:use_floating_ips')) {
                        // we're using a floating IP; resolve the user object
                        deferred.resolve(user);
                    } else {
                        // we're using a fixed IP; try to find it
                        if (server.addresses && server.addresses.private && server.addresses.private.length > 0) {
                            // the fixed IP should be a private address
                            user.vm_ip = server.addresses.private[0].addr;
                            deferred.resolve(user);
                        } else if (server.addresses && server.addresses.public && server.addresses.public.length > 0) {
                            // sometimes the fixed IP is a public address
                            user.vm_ip = server.addresses.public[0].addr;
                            deferred.resolve(user);
                        }
                        else {
                            // we didn't find a fixed IP at all
                            destroyAndReject(user.vm_id, deferred, "createAndStartVM failed: cannot find IP of new VM");
                        }
                    }
                }
            });
        }
    });
    return deferred.promise;
};

/**
 * List all volumes available to the User
 *
 * TESTED
 * @param callback
 */
openstack.getVolumes = function (callback) {
    openstack.blockClient.getVolumes(false, callback);
}


/**
 * Create a Volume for a User
 *
 * TESTED
 * @param user object
 * @returns {adapter.deferred.promise|*|promise|Q.promise}
 */
openstack.createVolumeForUser = function (user) {
    var deferred = Q.defer();
    var nme = "svmp-user-volume_" + user.username;
    var desc = "Block Storage for: " + user.username;
    var goldSize = svmp.config.get('settings:new_vm_defaults:goldsnapshotSize');
    var goldId = svmp.config.get('settings:new_vm_defaults:goldsnapshotId');

    var opts = {name: nme, size: goldSize, description: desc, snapshotId: goldId };

    openstack.blockClient.createVolume(opts, function (err, vol) {
        if (err) {
            deferred.reject(new Error('Creating Volume: ' + err.message));
        } else {
            user.volume_id = vol.id;
            deferred.resolve({user: user});
        }
    });

    return deferred.promise;
};

/**
 * Attach a Volume to a VM
 * @param user
 * @returns {adapter.deferred.promise|*|promise|Q.promise}
 */
openstack.attachVolumeToVMForUser = function (user) {
    var deferred = Q.defer();
    openstack.computeClient.attachVolume(user.vm_id, user.volume_id, function (err, result) {
        if (err) {
            destroyAndReject(user.vm_id, deferred, "attachVolumeToVMForUser failed", err);
        } else {
            deferred.resolve(user);
        }
    });
    return deferred.promise;
};

/**
 * Allocates a new IP and assigns it to a VM
 * @param user
 * @returns {adapter.deferred.promise|*|promise|Q.promise}
 */
openstack.assignFloatingIpToVM = function (user) {
    var deferred = Q.defer();

    if (svmp.config.isEnabled('settings:new_vm_defaults:use_floating_ips')) {

        var pool = svmp.config.get('settings:new_vm_defaults:floating_ip_pool'); // optional

        // first, allocate a new IP
        openstack.computeClient.allocateNewFloatingIp(pool, function (err, ip) {
            if (err) {
                destroyAndReject(user.vm_id, deferred, "assignFloatingIpToVM failed, couldn't allocate address", err);
            } else {
                // get user IP information from response object
                user.vm_ip = ip.ip;
                user.vm_ip_id = ip.id;

                svmp.logger.verbose("Allocated floating IP '%s', ID '%s'", ip.ip, ip.id);

                // we've allocated an IP, now assign it to the VM
                openstack.computeClient.addFloatingIp(user.vm_id, user.vm_ip, function (err) {
                    if (err) {
                        destroyAndReject(user.vm_id, deferred, "assignFloatingIpToVM failed, couldn't add address to VM", err);
                    } else {
                        // success
                        deferred.resolve(user);
                    }
                });
            }
        });
    } else {
        deferred.resolve(user);
    }

    return deferred.promise;
};

/**
 * De-allocates a floating IP and returns it to the pool
 * @param user
 * @returns {adapter.deferred.promise|*|promise|Q.promise}
 */
function deallocateFloatingIp(user) {
    var deferred = Q.defer();

    openstack.computeClient.deallocateFloatingIp(user.vm_ip_id, function (err) {
        if (err) {
            deferred.reject(new Error("deallocateFloatingIp failed: " + err.message));
        } else {
            svmp.logger.verbose("De-allocated floating IP '%s'", user.vm_ip);
            deferred.resolve(user);
        }
    });
    return deferred.promise;
}

/*
 * Destroys a VM for a user. Used during the background interval in the proxy.
 * @param {Obj} the request object: {vm_id: ''}
 * @returns a Promise with the request object
 */
openstack.destroyVM = function (obj, callback) {
    var deferred = Q.defer();

    // this step takes place after this promise has been resolved or rejected
    deferred.promise
        .fin(function () {
            // destroying the VM has resolved
            // if we are using floating IPs, try to de-allocate this VMs IP
            if (obj.vm_ip_id && obj.vm_ip_id.length > 0) {
                deallocateFloatingIp(obj)
                    // this is separate from destroying the VM, so if it fails, just print the error
                    .catch(function (e) {
                        svmp.logger.error(e.message);
                    });
            }
        });

    // we only need to try to destroy the VM if the vm_id is defined
    if (obj.vm_id && obj.vm_id.length > 0) {
        openstack.computeClient.destroyServer(obj.vm_id, function (err, id) {
            if (err) {
                deferred.reject(new Error("destroyVM failed: " + err));
            } else {
                svmp.logger.verbose("Destroyed expired VM, ID '%s'", obj.vm_id);
                deferred.resolve(obj);
            }
        });
    } else {
        deferred.resolve(obj);
    }

    return deferred.promise;
};

/*
 * Restarts a VM. Used at the end of VM creation in the proxy.
 * @param {Obj} the request object: {vm_id: ''}
 * @returns a Promise with the request object
 */
openstack.restartVM = function (obj) {
    var deferred = Q.defer();

    openstack.computeClient.rebootServer(obj.vm_id, {type: 'HARD'}, function (err) {
        if (err) {
            destroyAndReject(obj.vm_id, deferred, "restartVM failed", err);
        } else {
            svmp.logger.verbose("Restarted VM, ID '%s'", obj.vm_id);
            deferred.resolve(obj);
        }
    });

    return deferred.promise;
};

/**
 * Called when an error occurs from an OpenStack API call during VM setup.
 * Destroys the VM, de-allocates its IP address if needed, and rejects the promise with an error message.
 * @param vm_id the ID of the VM to destroy
 * @param deferred the Q promise to reject
 * @param message the message to throw in the reject Error
 * @param err optional, an error to concatenate to the message
 */
destroyAndReject = function (vm_id, deferred, message, err) {
    // a VM was created; destroy it, then throw an error
    openstack.destroyVM({'vm_id': vm_id})
        .fin(function () {
            // if an error message is defined, concatenate it to the message; otherwise, just use the message
            if (err)
                deferred.reject(new Error(message + ", " + err.message));
            else
                deferred.reject(new Error(message));
        });
};
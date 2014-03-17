/*
 * Copyright 2013 The MITRE Corporation, All Rights Reserved.
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
 * author Dave Bryson
 *
 */

'use strict';

var PkgCloud = require('pkgcloud'),
    Q = require('q'),
    winston = require('winston'),
    settings = global.config.settings;

var computeClient = PkgCloud.providers.openstack.compute.createClient(settings.openstack);
var blockClient = PkgCloud.providers.openstack.blockstorage.createClient(settings.openstack);

/**
 * Get all the flavors available in Openstack
 * @param callback
 */
exports.getFlavors = function (callback) {
    computeClient.getFlavors(function (err, flavors) {
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
exports.getImages = function (callback) {
    computeClient.getImages(function (err, images) {
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
exports.createAndStartVM = function (user, image, flavor) {
    var deferred = Q.defer();
    var vmObj = {
        name: "svmp_user_vm_" + user.username,
        flavor: flavor,
        image: image
    };
    computeClient.createServer(vmObj, function (err, server) {
        if (err) {
            deferred.reject(new Error("createAndStartVM failed, couldn't create server: " + err.message));
        } else {
            server.setWait({status: server.STATUS.running}, settings.new_vm_defaults.pollintervalforstartup, function (err) {
                if (err) {
                    destroyAndReject(server.id, deferred, "createAndStartVM failed, waiting for startup", err);
                } else {
                    user.vm_id = server.id;
                    // if we aren't going to use a floating IP, then use the fixed IP that was returned
                    if (settings.new_vm_defaults.use_floating_ips) {
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
 * Create a Volume for a User
 * @param user object
 * @returns {adapter.deferred.promise|*|promise|Q.promise}
 */
exports.createVolumeForUser = function (user) {
    var deferred = Q.defer();
    var nme = user.username + "_volume";
    var desc = "Block Storage for: " + user.username;
    var goldSize = settings.new_vm_defaults.goldsnapshotSize;
    var goldId = settings.new_vm_defaults.goldsnapshotId;

    var opts = {name: nme, size: goldSize, description: desc, snapshotId: goldId };

    blockClient.createVolume(opts, function (err, vol) {
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
exports.attachVolumeToVMForUser = function (user) {
    var deferred = Q.defer();
    computeClient.attachVolume(user.vm_id, user.volume_id, function (err, result) {
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
exports.assignFloatingIpToVM = function (user) {
    var deferred = Q.defer();

    if (settings.new_vm_defaults.use_floating_ips) {
        var pool = settings.new_vm_defaults.floating_ip_pool; // optional
        // first, allocate a new IP
        computeClient.allocateNewFloatingIp(pool, function(err, ip) {
            if (err) {
                destroyAndReject(user.vm_id, deferred, "assignFloatingIpToVM failed, couldn't allocate address", err);
            } else {
                // get user IP information from response object
                user.vm_ip = ip.ip;
                user.vm_ip_id = ip.id;
                winston.verbose("Allocated floating IP '%s', ID '%s'", ip.ip, ip.id);

                // we've allocated an IP, now assign it to the VM
                computeClient.addFloatingIp(user.vm_id, user.vm_ip, function(err) {
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
}

/**
 * De-allocates a floating IP and returns it to the pool
 * @param user
 * @returns {adapter.deferred.promise|*|promise|Q.promise}
 */
exports.deallocateFloatingIp = function (user) {
    var deferred = Q.defer();

    computeClient.deallocateFloatingIp(user.vm_ip_id, function(err) {
        if (err) {
            deferred.reject(new Error("deallocateFloatingIp failed: " + err.message));
        } else {
            winston.verbose("De-allocated floating IP '%s'", user.vm_ip);
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
exports.destroyVM = function (obj, callback) {
    var deferred = Q.defer();

    // this step takes place after this promise has been resolved or rejected
    deferred.promise
        .fin(function() {
            // destroying the VM has resolved
            // if we are using floating IPs, try to de-allocate this VMs IP
            if (obj.vm_ip_id) {
                exports.deallocateFloatingIp(obj)
                    // this is separate from destroying the VM, so if it fails, just print the error
                    .catch(function(e) {
                        winston.error(e.message);
                    });
            }
        });

    // we only need to try to destroy the VM if the vm_id is defined
    if (obj.vm_id) {
        computeClient.destroyServer(obj.vm_id, function (err, id) {
            if (err) {
                deferred.reject(new Error("destroyVM failed: " + err));
            } else {
                winston.verbose("Destroyed expired VM, ID '%s'", obj.vm_id);
                deferred.resolve(obj);
            }
        });
    } else {
        deferred.resolve(obj);
    }

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
function destroyAndReject(vm_id, deferred, message, err) {
    // a VM was created; destroy it, then throw an error
    exports.destroyVM({'vm_id': vm_id})
        .fin(function() {
            // if an error message is defined, concatenate it to the message; otherwise, just use the message
            if (err)
                deferred.reject(new Error(message + ", " + err.message));
            else
                deferred.reject(new Error(message));
        });
}
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
 * @author Joe Portner
 *
 */

var
    AWS = require('aws-sdk'),
    PkgCloud = require('pkgcloud'),
    Q = require('q'),
    svmp = require('./../svmp');

var aws = exports;

aws.init = function () {
    var awsInfo = svmp.config.get('settings:aws');
    if (!awsInfo) {
        svmp.logger.error("Failed to initialize AWS: cloud_platform set to 'aws', but no AWS config (settings:aws) found!");
        process.exit(1);
    }

    // Configure our AWS connection (keys may be automatically imported from environment vars instead)
    AWS.config.update(awsInfo);

    // construct an EC2 service interface object
    this.ec2 = new AWS.EC2();

    // construct a pkgcloud compute client object
    var openstackInfo = {
        key: awsInfo.secretAccessKey,
        keyId: awsInfo.accessKeyId
    }
    this.computeClient = PkgCloud.providers.amazon.compute.createClient(openstackInfo);
};

/**
 * @param userSessionObj {user, session} where: user: {} and session: {}
 * @returns {adapter.deferred.promise|*|promise|Q.promise}
 */
aws.setUpUser = function (userSessionObj) {
    var deferred = Q.defer();
    var flvr = svmp.config.get('settings:new_vm_defaults:vmflavor');
    var user = userSessionObj.user;
    var img = svmp.config.get('settings:new_vm_defaults:images')[user.device_type];

    // if the user's VM already exists, just resolve it
    if (user.vm_ip && user.vm_ip.length > 0) {
        deferred.resolve(userSessionObj);
    }
    else {
        aws.createAndStartVM(user, img, flvr)
            .then(aws.attachVolumeToVMForUser)
            // once the VM is set up, restart it so it will mount the volume correctly
            .then(aws.restartVM)
            // after creating the VM and completing all sub-tasks, save user info in the model
            .then(svmp.users.updateUser)
            .then(function (updatedUser) {
                deferred.resolve({session: userSessionObj.session, user: updatedUser});
            }, function (err) {
                deferred.reject(new Error("VM setup failed: " + err.message));
            })
            .catch(function (error) {
                svmp.logger.error("Error creating user: ", error);
            })
            .done();
    }

    return deferred.promise;
};


/**
 * Get all the instance types available in EC2
 * @param callback
 */
aws.getFlavors = function (callback) {
    // no API for this; instead of hard-coding these, display URL for user
    callback(undefined, [{name:"EC2 instance types:", _id:"http://aws.amazon.com/ec2/instance-types/"}]);;
};

/**
 * Return a list of VM image information
 * @param callback
 */
aws.getImages = function (callback) {
    var params = {Owners: ['self']};
    aws.ec2.describeImages(params, function(err, data) {
        if (err) {
            callback(err);
        } else {
            var list = [];
            data.Images.forEach(function(element, index, array) {
                list.push({_id: element.ImageId, name: element.Name/*, State: element.State*/});
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
aws.createAndStartVM = function (user, image, flavor) {
    var deferred = Q.defer();
    var vmObj = {
        //name: "svmp-user-instance_" + user.username,
        flavor: flavor,
        image: image,
        zone: svmp.config.get('settings:aws:availabilityZone')
    };
    aws.computeClient.createServer(vmObj, function (err, server) {
        if (err) {
            deferred.reject(new Error("createAndStartVM failed, couldn't create instance: " + err.message));
        } else {
            var poll = svmp.config.get('settings:new_vm_defaults:pollintervalforstartup');
            server.setWait({status: server.STATUS.running}, poll, function (err) {
                if (err) {
                    destroyAndReject(server.id, deferred, "createAndStartVM failed, waiting for startup", err);
                } else {
                    user.vm_id = server.id;

                    // we're using a fixed IP; try to find it
                    if (server.addresses && server.addresses.public && server.addresses.public.length > 0) {
                        // the fixed IP should be a public address
                        user.vm_ip = server.addresses.public[0];
                    } else if (server.addresses && server.addresses.private && server.addresses.private.length > 0) {
                        // sometimes the fixed IP is a private address
                        user.vm_ip = server.addresses.private[0];
                    }

                    if (user.vm_ip && user.vm_ip.length > 0) {
                        createNameTag(user.vm_id, "svmp-user-instance_" + user.username + "-" + new Date().getTime() )
                            .then(function (obj) {
                                deferred.resolve(user);
                            })
                            .catch(function (err) {
                                destroyAndReject(user.vm_id, deferred, "createAndStartVM failed", err)
                            })
                            .done();
                    }
                    else {
                        // we didn't find a fixed IP at all
                        destroyAndReject(user.vm_id, deferred, "createAndStartVM failed: cannot find IP of new VM");
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
aws.getVolumes = function (callback) {
    var params = {};
    aws.ec2.describeVolumes(params, function(err, data) {
        if (err) {
            callback(err);
        } else {
            var list = [];
            data.Volumes.forEach(function(element, index, array) {
                // try to find the name of this volume, if it exists
                var volName = undefined;
                for (var i = 0; i < element.Tags.length; i++) {
                    if (element.Tags[i].Key === "Name") {
                        volName = element.Tags[i].Value;
                        break;
                    }
                }
                // push this volume's info to the output list
                list.push({id: element.VolumeId, status: element.State, name: volName}); // can't get volume name/description...
            });
            callback(undefined, list);
        }
    });
}

/**
 * Create a Volume for a User
 *
 * TESTED
 * @param user object
 * @returns {adapter.deferred.promise|*|promise|Q.promise}
 */
aws.createVolumeForUser = function (user) {
    var deferred = Q.defer();

    var params1 = {
        AvailabilityZone: svmp.config.get('settings:aws:availabilityZone'),
        SnapshotId: svmp.config.get('settings:new_vm_defaults:goldsnapshotId')
    };

    aws.ec2.createVolume(params1, function (err, data) {
        if (err) {
            deferred.reject(new Error('Could not create volume: ' + err.message));
        } else {
            createNameTag(data.VolumeId, "svmp-user-volume_" + user.username)
                .then(function (obj) {
                    user.volume_id = data.VolumeId;
                    deferred.resolve({user: user});
                })
                .catch(function (err) {
                    deferred.reject(err);
                })
                .done();
        }
    });

    return deferred.promise;
};

// creates a "Name" Tag for a given AWS resource
function createNameTag(resourceId, nameTag) {
    var deferred = Q.defer();
    var params = {
        Resources: [resourceId],
        Tags: [{Key: "Name", Value: nameTag}]
    };

    aws.ec2.createTags(params, function(err, data) {
        if (err) {
            deferred.reject(new Error("Could not tag resource '" + resourceId + "' with name '" + nameTag + "': " + err.message));
        } else {
            deferred.resolve();
        }
    });

    return deferred.promise;
}

/**
 * Attach a Volume to a VM
 * @param user
 * @returns {adapter.deferred.promise|*|promise|Q.promise}
 */
aws.attachVolumeToVMForUser = function (user) {
    var deferred = Q.defer();
    var params = {
        Device: "/dev/sdb1",
        InstanceId: user.vm_id,
        VolumeId: user.volume_id
    };
    aws.ec2.attachVolume(params, function (err, result) {
        if (err) {
            destroyAndReject(user.vm_id, deferred, "attachVolumeToVMForUser failed", err);
        } else {
            deferred.resolve(user);
        }
    });
    return deferred.promise;
};

/*
 * Destroys a VM for a user. Used during the background interval in the proxy.
 * @param {Obj} the request object: {vm_id: ''}
 * @returns a Promise with the request object
 */
aws.destroyVM = function (obj, callback) {
    var deferred = Q.defer();

    // we only need to try to destroy the VM if the vm_id is defined
    if (obj.vm_id && obj.vm_id.length > 0) {
        aws.computeClient.destroyServer(obj.vm_id, function (err, id) {
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
aws.restartVM = function (obj) {
    var deferred = Q.defer();

    aws.computeClient.rebootServer(obj.vm_id, function (err) {
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
    aws.destroyVM({'vm_id': vm_id})
        .fin(function () {
            // if an error message is defined, concatenate it to the message; otherwise, just use the message
            if (err)
                deferred.reject(new Error(message + ", " + err.message));
            else
                deferred.reject(new Error(message));
        });
};
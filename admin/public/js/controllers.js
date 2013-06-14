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

function UserListController($scope, users) {
    $scope.users = users;
}

function UserAddController($scope, $http, $location) {
    $scope.user = {username: '', password: '', password_conf: '', vminstance_ip: '', vminstance_port: '', admin: false};
    $scope.message = '';

    $scope.save = function (user) {
        delete user.password_conf;

        $http.post('/users', user)
            .success(function () {
                $location.path('/');
            }).error(function () {
                $scope.message = "Username already exists";
            });
    };

    $scope.cancel = function () {
        $location.path('/');
    };

    // Check if passwords match
    $scope.passwordDontMatch = function (user) {
        return (user.password !== user.password_conf);
    };
}

function UserEditController($scope, $http, $location, user) {
    $scope.user = user;
    $scope.message = '';

    $scope.save = function (user) {
        $scope.user.$save(function (user) {
            $location.path('/');
        });
    };

    $scope.cancel = function () {
        $location.path('/');
    };

    $scope.remove = function () {
        $scope.user.$remove(function () {
            $location.path('/');
        });
    };

}

function UserPasswordChangeController($scope, $http, $location, user) {
    $scope.user = {_id: user._id, username: user.username, password: '', password_conf: ''};
    $scope.message = '';

    $scope.save = function (user) {
        delete user.password_conf;

        $http.post('/users/change', user)
            .success(function () {
                $location.path('/');
            }).error(function () {
                $scope.message = "Problem Changing the Password";
            });
    };

    $scope.cancel = function () {
        $location.path('/');
    };

    // Check if passwords match
    $scope.passwordDontMatch = function (user) {
        return (user.password !== user.password_conf);
    };
}
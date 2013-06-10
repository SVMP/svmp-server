
var services = angular.module('svmp.services', ['ngResource']);

// Users resource
services.factory('User', ['$resource', function ($resource) {
    return $resource('/users/:id', {id: '@id'});
}]);

// Wraps the resource query with a deferred promise
services.factory('ListUsersLoader', ['User', '$q', function (User, $q) {
    return function () {
        var delay = $q.defer();
        console.log("Calling listUsers service");
        User.query(function (users) {
            delay.resolve(users);
        }, function () {
            delay.reject('Unable to fetch users');
        });
        return delay.promise;
    };
}]);

// Wraps the resource query with a deferred promise
services.factory('UserLoader', ['User', '$route', '$q', function (User, $route, $q) {
    return function () {
        var delay = $q.defer();
        User.get({id: $route.current.params.userId}, function (user) {
            delay.resolve(user);
        }, function () {
            delay.reject('Unable to fetch user ' + $route.current.params.userId);
        });
        return delay.promise;
    };
}]);



angular.module('svmp')
    .controller('UserRegisterCtrl',
        ['$scope', '$http', '$window', '$location', function ($scope, $http, $window, $location) {
            $scope.user = {username: '', password: '', password_conf: '', vminstance_ip: '', vminstance_port: ''};
            $scope.message = '';

            $scope.save = function (user) {
                delete user.password_conf;

                $http.post('/users', user)
                    .success(function () {
                        // Redirect user to app as logged in user
                        $window.location.href = '/404.html';
                    }).error(function () {
                        $scope.message = "Username or Password exists";
                        $location.path('/');
                    });
            };

            // Check if passwords match
            $scope.passwordDontMatch = function (user) {
                return (user.password !== user.password_conf);
            };
        } ]);

var app = angular.module('myApp', []);
var socket = io.connect();

// using angular with socket.io
app.factory('socket', ['$rootScope', function ($rootScope) {
    return {
        on: function (eventName, callback) {
            function wrapper() {
                var args = arguments;
                $rootScope.$apply(function () {
                    callback.apply(socket, args);
                });
            }
            socket.on(eventName, wrapper);
            return function () {
                socket.removeListener(eventName, wrapper);
            };
        },
        emit: function (eventName, data, callback) {
            socket.emit(eventName, data, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    if(callback) {
                        callback.apply(socket, args);
                    }
                });
            });
        }
    };
}]);

app.controller('myCtrl', function($scope, socket) {
    socket.on('send_trucks', function (b) {

        $scope.trucklist1 = b;

    });

    socket.on('tab2_gettruck_back', function (c) {

        $scope.trucklist2 = c; // [[truck name, truckid],[],...]

    });

    socket.on('tab1_sendtrucks', function (d) {

        $scope.trucklist3 = d;

    });
    //tab1, remove order, delete order
    $scope.deletemyorder =function(x,a) {
        var deletedobject= [x[2],0,0,0,x[0],x[3]];
        var deletedid= x[a]; // x[a]=[id, customer]
        var y= [deletedobject, deletedid[0]];



        var r = confirm("Deleting order. Are you sure?");
        if (r == true) {
            socket.emit('tab1_deleteselected',y)
        }
    }

});

var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var request = require('request');
var fs = require("fs");
var path = require("path");
var io = require('socket.io')(http);

// volume parameters for container loading problem
var initial_allitems=0;
var initial_allreconfig=0;
var new_ordervolume=0;
var new_allreconfig=0;

var exceedflag =0; //if new order has too many items, reconfig() returns exceedflag=1
var loop_flag=0; //flag for setting starting location
var new_current_in=[]; //modified current_in
var new_out=[]; //modified out array
var finish_add_out_order_flag = 0; //0=Orders are not in LIFO structure. 1=Orders are in LIFO structure

//Container Dimensions. 1 unit ~40cm
var x_container = 33; //unit
var y_container = 6;
var z_container = 7;
var max_vol = 1188;

var Fleet_db; //Truck fleet data
var Fleet; // Parsed fleet data
var global_flagval=1; // real-time tab, user status info

var MongoClient = require('mongodb').MongoClient;
var DATAdb=[]; // Array for data coming from database

app.use(express.static(path.join("C:/Users/Ufuk/Desktop/Thesis_", 'public')));

//Get Page
app.get('/', function(req, res) {
    res.sendfile(__dirname + '/index.html');
    console.log('app.get/ ok');
});

//connect to database
MongoClient.connect("mongodb://localhost:27017/thesis_db_1" , function(err, db) {

    console.log("Connected to database 'thesis_db_1'");

    db.collection("thesis_collection").find({}).toArray(function(err, result) {
        DATAdb=result;
        Fleet_db=DATAdb[DATAdb.length-1];
        Fleet= JSON.parse(JSON.stringify(Fleet_db));
        delete Fleet._id;
        console.log("db collected");
    });

    //Whenever someone connects this is executed
    io.on('connection', function(socket) {

        console.log('A user connected');

        //a user is disconnected
        socket.on('disconnect', function () {
            console.log('A user disconnected');
        });

        //save changes to file
        socket.on('savefile', function () {

            db.collection("thesis_collection").save(Fleet);
            console.log("Data is saved to db");
            socket.broadcast.emit('db_message', "Database is modified by another user" );
        });

        //Tab-3, new user gets real-time status info
        socket.emit('other_status', global_flagval );

        //Tab-3, a client adds an item
        socket.on('tab3_add', function (mm) {

            //server broadcasts added object info to all clients
            socket.broadcast.emit('tab3_sendadded', mm);
        });

        //Tab-3,
        //real time data communication between clients.
        //when a client moves an object at Tab 3, other clients display the movement in real time.
        socket.on('tab3_movement', function (n){
            if(n.length!=0){
                socket.broadcast.emit('tab3_sendmove',n); //movement update
            }
        });

        //Tab-3, global_flagval is used to to emit current value to a new user who is connected to this group later.
        socket.on("tab3_status", function (flagval) {

            global_flagval=flagval;
            socket.broadcast.emit('other_status', flagval )
        });

        //Tab-2, create incoming trucks list for selected location
        socket.on('tab2_gettruck', function (s){
            //s=selected location
            var truck_list_tab2=[];

            for(var truck in Fleet_db){
                for(var stop in Fleet_db[truck].route){
                    if (s==stop) {
                        truck_list_tab2.push([truck,Fleet_db[truck].truckid]);
                    }
                }
            }

            socket.emit('tab2_gettruck_back', truck_list_tab2);
        });

        //Tab-2, Visualize content for selected truck
        socket.on('tab2_loadingplans', function(loc_truck) {

            var s_tab2 = loc_truck; //[location, truck]
            db.collection("thesis_collection").find({}).toArray(function(err, result) {
                DATAdb=result;
                Fleet_db=DATAdb[DATAdb.length-1];
                Fleet= JSON.parse(JSON.stringify(Fleet_db));
                delete Fleet._id;
                console.log("Fleet info retrieved");

                var Fleet_tab2 = JSON.parse(JSON.stringify(Fleet_db));

                // If truck is not empty
                if (Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_initial.length != 0 ||
                    Fleet_tab2[s_tab2[1]].route[s_tab2[0]].out.length != 0) {

                    //item information of inital state
                    var counter_in = 0; // counter for positions in container, for initial state of items
                    var initial_inf = []; // initial state information
                    for (var order_in in Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_initial) {
                        for (var item_in in Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_initial[order_in].items_list) {
                            var item_inf_in = [Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_initial[order_in].items_list[item_in].id, // item_id
                                Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_initial[order_in].items_list[item_in].x,  // height of cubic object                                             //height
                                Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_initial[order_in].color,           // color of order
                                Fleet[s_tab2[1]].positions[counter_in],                                     //initial position in container
                                Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_initial[order_in].origin,         // origin
                                Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_initial[order_in].destination,     // destination
                                Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_initial[order_in].customer,         // customer
                                Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_initial[order_in].order_id,          //order_id
                                [0, 0, 0]//,  //reconfig positions. default value is empty
                                //Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_initial[n].status             // status

                            ];
                            initial_inf.push(item_inf_in);
                            counter_in++;
                        }
                    }


                    //item information of final state
                    var counter_fin = 0; // counter for positions in container, for final state of items
                    var final_inf = []; // get information of all items from in_final array
                    for (var order_fin in Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_final) {
                        for (var item_fin in Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_final[order_fin].items_list) {
                            //in_final.item list consists of both "out" and "reconfig" status(items are moved from these areas into container).
                            //These items' status are "in". But we need initial status. if item's origin = this stop, that means
                            // that item is at out area. else, at reconfig area

                            //out area. status=out
                            if (Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_final[order_fin].origin == s_tab2[0]) {
                                var item_inf_fin = [Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_final[order_fin].items_list[item_fin].id, //item_id
                                    Fleet[s_tab2[1]].positions[counter_fin],                                     // final position in container
                                    "out"                                                                 // status
                                ];
                                final_inf.push(item_inf_fin);
                                counter_fin++;
                            }

                            //else, reconfig-area
                            else {
                                var item_inf_fin = [Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_final[order_fin].items_list[item_fin].id, //item_id
                                    Fleet[s_tab2[1]].positions[counter_fin],                                     // final position in container
                                    Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_final[order_fin].status             // status
                                ];
                                final_inf.push(item_inf_fin);
                                counter_fin++;
                            }

                        }
                    }


                    //item information from out area
                    var counter_out = 0;
                    var inc = 0; //placement point increment
                    for (var order_out in Fleet_tab2[s_tab2[1]].route[s_tab2[0]].out) {
                        points_out = [];
                        create_pos_out(Fleet_tab2[s_tab2[1]].route[s_tab2[0]].out[order_out].items_list[0].x); //create placement points at out area
                        points_out = points_out.slice(0, Fleet_tab2[s_tab2[1]].route[s_tab2[0]].out[order_out].items_list.length);
                        //number of points are now equal to number of items
                        points_out = points_out.reverse(); //alignment

                        for (var item_out in Fleet_tab2[s_tab2[1]].route[s_tab2[0]].out[order_out].items_list) {

                            var item_inf_out = [Fleet_tab2[s_tab2[1]].route[s_tab2[0]].out[order_out].items_list[item_out].id, // item_id
                                Fleet_tab2[s_tab2[1]].route[s_tab2[0]].out[order_out].items_list[item_out].x,  // height of cubic object   //height
                                Fleet_tab2[s_tab2[1]].route[s_tab2[0]].out[order_out].color,           // color of order
                                [points_out[counter_out][0], points_out[counter_out][1] + inc, points_out[counter_out][2]],//initial position in out area
                                Fleet_tab2[s_tab2[1]].route[s_tab2[0]].out[order_out].origin,         // origin
                                Fleet_tab2[s_tab2[1]].route[s_tab2[0]].out[order_out].destination,     // destination
                                Fleet_tab2[s_tab2[1]].route[s_tab2[0]].out[order_out].customer,         // customer
                                Fleet_tab2[s_tab2[1]].route[s_tab2[0]].out[order_out].order_id,
                                [0, 0, 0]//, //reconfig positions. default value is empty
                                //order_id
                                //Fleet_tab2[s_tab2[1]].route[s_tab2[0]].in_initial[n].status             // status
                            ];
                            initial_inf.push(item_inf_out);

                            counter_out++;
                        }

                        //placement increment
                        inc = inc + points_out[counter_out - 1][1] - points_out[0][1] - 2 * item_inf_out[1];
                        counter_out = 0; // Reset next order's starting point. New order will be placed next to previous order.
                    }


                    //add "final status", "final positions" into initial_inf array if item is same in initial_inf and final_inf arrays
                    var counter_dest = Fleet[s_tab2[1]].pos_dest.length - 1;
                    for (var a = initial_inf.length - 1; a >= 0; a--) {
                        if (initial_inf[a][5] == s_tab2[0]) {
                            //destination of an item in container = this stop, add status="destination"
                            initial_inf[a] = initial_inf[a].concat([Fleet[s_tab2[1]].pos_dest[counter_dest], "destination"]);
                            counter_dest--;
                        }

                        for (var b = 0; b < final_inf.length; b++) {
                            if (initial_inf[a][0] == final_inf[b][0]) {
                                initial_inf[a] = initial_inf[a].concat(final_inf[b].slice(1));
                            }
                        }
                    }

                    // Reconfig items inside container, are taken out to reconfig area.
                    var counter_reconfig = 0;
                    var ye = 0; //offset
                    pos_rec = [];
                    create_pos_rec(initial_inf[0][1]);

                    //add reconfig positions to reconfig item
                    for (var a = initial_inf.length - 1; a >= 0; a--) {
                        if (initial_inf[a][10] == "reconfig") {
                            if (initial_inf[a + 1] !== undefined) {
                                if (initial_inf[a][7] != initial_inf[a + 1][7]) {
                                    ye = ye + 2 * initial_inf[0][1];
                                    counter_reconfig = 0;
                                    initial_inf[a][8][0] = pos_rec[counter_reconfig][0];
                                    initial_inf[a][8][1] = pos_rec[counter_reconfig][1] + ye;
                                    initial_inf[a][8][2] = pos_rec[counter_reconfig][2];
                                    counter_reconfig++;
                                }
                                else {
                                    initial_inf[a][8][0] = pos_rec[counter_reconfig][0];
                                    initial_inf[a][8][1] = pos_rec[counter_reconfig][1] + ye;
                                    initial_inf[a][8][2] = pos_rec[counter_reconfig][2];
                                    counter_reconfig++
                                }
                            }
                            else {
                                initial_inf[a][8][0] = pos_rec[counter_reconfig][0];
                                initial_inf[a][8][1] = pos_rec[counter_reconfig][1] + ye;
                                initial_inf[a][8][2] = pos_rec[counter_reconfig][2];
                                counter_reconfig++
                            }

                        }
                    }

                    // send items to be visualized
                    for (var item_no = 0; item_no < initial_inf.length; item_no++) {
                        socket.emit('items', initial_inf[item_no]);
                    }
                    //send position points inside container
                    socket.emit('position_cont', Fleet[s_tab2[1]].positions);
                }

                //Truck is empty
                else {
                    socket.emit('position_cont', 0);
                }

            });

        });

        //Tab-1, new order. User adds a new order to system. Search available trucks, return truck_list
        socket.on('trucklist', function (as) {
            //user sent as= [origin, destination]
            var flag_route;
            var truck_list=[];

            //get suitable trucks
            //first find the origin, then destination of truck's route.
            for(var truck in Fleet_db){
                //if flag=0, check origin in truck's route, flag1= check destination in truck's route
                flag_route=0;
                for(var stop in Fleet_db[truck].route){

                    // flag=0 and origin matches with a stop in truck's route
                    if (flag_route==0 && as[0]== stop) {
                        //increase flag value for checking destination
                        flag_route++ ;
                    }
                    // flag=1 and dest matches with a stop in truck's route
                    if(flag_route==1 &&  as[1]== stop){
                        //push the truck into the list
                        truck_list.push(truck);
                    }
                }
            }

            socket.emit('send_trucks', truck_list );

        });

        //Tab-1, new order. User input order information. Visualize the result for the new order
        socket.on('visualize_data', function (visual_data){
            //incoming data: visual_data[origin, destination, customer name, amount, truck_name, height ]

            db.collection("thesis_collection").find({}).toArray(function(err, result) {

                DATAdb=result;
                Fleet_db=DATAdb[DATAdb.length-1];
                Fleet= JSON.parse(JSON.stringify(Fleet_db));
                delete Fleet._id;
                console.log("Fleet info retrieved");
                initial_allitems=0;
                initial_allreconfig=0;
                new_ordervolume=0;



                //Calculate delay ratio
                //delay ratio=(final state vol - initial state vol)/initial state vol  ((1+3+4) - (1+2))/(1+2) = (3+4-2)/(1+2)

                //initial state vol=initial_allitems(1)+initial_allreconfig(2) (volume of all items + all reconfig volume)

                //When a  new order is added, reconfig() is called to create a loading pattern. Then, calculate final state vol.

                //final state vol=initial_allitems(1) + new_ordervolume(3) + new_allreconfig(4)

                //1=loading volume of all items, 3=new order's loading volume,  4=all new reconfig volume


                // initial_allitems (1) volume of initial items
                for(var stop1 in Fleet[visual_data[4]].route){
                    for(var order1=0; order1<Fleet[visual_data[4]].route[stop1].out.length; order1++){
                        initial_allitems= initial_allitems + Fleet[visual_data[4]].route[stop1].out[order1].items_list.length;
                    }
                }

                // initial_allreconfig (2) volume of initial reconfigured items
                for(var stop2 in Fleet[visual_data[4]].route){
                    for(var order2=0; order2<Fleet[visual_data[4]].route[stop2].in_final.length; order2++){
                        if(Fleet[visual_data[4]].route[stop2].in_final[order2].status=="reconfig"){
                            initial_allreconfig= initial_allreconfig + Fleet[visual_data[4]].route[stop2].in_final[order2].items_list.length;
                        }
                    }
                }

                //Create loading patterns and pick the best one.
                reconfig(Fleet,visual_data);

                //If the total volume of orders exceed truck's volume
                if(exceedflag == 1){
                    socket.emit('exceed', "exceed");
                    return;
                }

                //delay rate as a percentage
                var rate = 100*( parseInt(visual_data[3]) + new_allreconfig - initial_allreconfig)/ (initial_allitems + initial_allreconfig) ;
                socket.emit('delay_rate', rate);


                //Items and placement position points are matched

                var counter_final=0;
                var final_inf=[]; //final state information
                for(var order3 in Fleet[visual_data[4]].route[visual_data[0]].in_final){
                    for (var item in Fleet[visual_data[4]].route[visual_data[0]].in_final[order3].items_list) {

                        var item_inf=[Fleet[visual_data[4]].route[visual_data[0]].in_final[order3].items_list[item].id, //itemid
                            visual_data[5],                                                               //height
                            Fleet[visual_data[4]].route[visual_data[0]].in_final[order3].color,           // color of order
                            Fleet[visual_data[4]].positions[counter_final],                                   //position in container
                            Fleet[visual_data[4]].route[visual_data[0]].in_final[order3].origin,         // origin
                            Fleet[visual_data[4]].route[visual_data[0]].in_final[order3].destination,     // destination
                            Fleet[visual_data[4]].route[visual_data[0]].in_final[order3].customer,         // customer
                            Fleet[visual_data[4]].route[visual_data[0]].in_final[order3].order_id,          //order_id
                            [0,0,0],  //reconfig position, default is empty
                            [0,0,0], // final position to display
                            Fleet[visual_data[4]].route[visual_data[0]].in_final[order3].status            //status
                        ];

                        counter_final++;
                        final_inf.push(item_inf);
                    }
                }

                //Send item information to front-end for visualization
                for(var items=0; items<final_inf.length; items++){
                    socket.emit('items', final_inf[items]);
                }

            });

        });

        //Tab-1, remove order. Send information and truck list to user
        socket.on('tab1_remove_getitemtruck', function (loc_r){
            var selected_loc = loc_r; //loc_r=selected location
            db.collection("thesis_collection").find({}).toArray(function(err, result) {

                DATAdb=result;
                Fleet_db=DATAdb[DATAdb.length-1];
                Fleet= JSON.parse(JSON.stringify(Fleet_db));

                delete Fleet._id;
                console.log("Fleet info retrieved");

                var A=[]; // [ a, a, ...]
                var a=[]; // [truck name, truck id, origin, height, order_id1, order_id2, ...]
                var flag=0; //if scanned truck has elements, flag==1

                for(var truck in Fleet){
                    for(var stop in Fleet[truck].route){
                        if(Fleet[truck].route[stop].out!==undefined){
                            if(stop==selected_loc && Fleet[truck].route[stop].out.length != 0){
                                flag=1;
                                a.push(truck); // a=["truck1"]  push truck name
                                a.push(Fleet[truck].truckid); // a=["1"] push truck id
                                a.push(stop); //push origin
                                a.push( Fleet[truck].route[stop].out[0].items_list[0].x ); //push item's height, it is needed for reconfig
                                for(var item_out in Fleet[truck].route[stop].out){
                                    a.push([Fleet[truck].route[stop].out[item_out].order_id,Fleet[truck].route[stop].out[item_out].customer]); // push order_id's
                                }
                            }
                        }
                    }
                    // if an array has elements. otherwise, this truck has no items at out area at this location
                    if(flag==1){
                        A.push(a); // A= [ [truck name, truck id, origin, height, order_id1, order_id2, ...]  ]
                        flag=0;
                        a=[];
                    }
                }

                socket.emit('tab1_sendtrucks', A);
            });
        });

        //Tab-1, remove order. Delete selected order
        socket.on('tab1_deleteselected', function (x){
            //x = selected truck
            //x[0}= visual_data=[origin,0,0,0,truckname,height]
            //x[1]= order_id

            db.collection("thesis_collection").find({}).toArray(function(err, result) {

                DATAdb=result;
                Fleet_db=DATAdb[DATAdb.length-1];
                Fleet= JSON.parse(JSON.stringify(Fleet_db));

                delete Fleet._id;
                console.log("Fleet info retrieved");


                // Delete the order
                var removeIndex = Fleet[x[0][4]].route[x[0][0]].out.map(function(item) { return item.order_id; })
                    .indexOf(x[1]);
                ~removeIndex && Fleet[x[0][4]].route[x[0][0]].out.splice(removeIndex, 1);

                //call reconfig() to update loading plan
                reconfig(Fleet,x[0]);

                //save the changes into database
                db.collection("thesis_collection").save(Fleet);
                console.log("FILE IS WRITTEN");

            });
        });

    });

});

http.listen(3000, function() {
    console.log('listening on *:3000');
});

//Order reconfiguration, when a new order is added or deleted
function reconfig(Fleet,visual_data){
    var incoming_order=[]; //new orders are placed into this array
    var current_in=[]; //The initial state of the selected truck at pick-up location of the new order. It contains all options.

    //If an order is deleted
    if(visual_data[1]== 0 && visual_data[2]== 0 && visual_data[3]== 0){

        //check all the remaining orders at all stops of this truck. If truck is empty then delete position points
        var emptycount=0;
        for(var x in Fleet[visual_data[4]].route){
            //if out-zone is empty then increase the value
            if (Fleet[visual_data[4]].route[x].out.length==0){
                emptycount++;
            }
            if(emptycount == Object.keys(Fleet[visual_data[4]].route).length){
                console.log("Truck is now empty");
                Fleet[visual_data[4]].positions=[];
                Fleet[visual_data[4]].pos_dest=[];
            }
        }

        incoming_order = [ { "origin": Object.keys(Fleet[visual_data[4]].route)[0] } ];
        current_in = [[Fleet[visual_data[4]].route[Object.keys(Fleet[visual_data[4]].route)[0]].in_initial]];
    }

    //If a new order is added
    else {
        incoming_order = [];
        var O7 = new order(visual_data[0], visual_data[1], visual_data[2]); //New Order object

        for (var i = 0; i < visual_data[3]; i++) { // push items into order
            O7.items_list.push(new item(visual_data[5], visual_data[5], visual_data[5], visual_data[0], visual_data[1])); // CUBIC ITEMS
        }

        incoming_order.push(O7); // incoming order has the new order
        Fleet[visual_data[4]].route[incoming_order[0].origin].out.unshift(incoming_order[0]);

        current_in = [[Fleet[visual_data[4]].route[incoming_order[0].origin].in_initial]];
    }

    exceedflag =0;
    loop_flag=0;
    new_current_in=[];
    new_out=[];
    finish_add_out_order_flag = 0;

    //Iterate stops at the route
    for(var m in Fleet[visual_data[4]].route){
        //Start from new order's pick-up location to final stop of the truck
        if( (incoming_order[0].origin == m && loop_flag==0) || (incoming_order[0].origin != m && loop_flag==1) ){
            loop_flag=1;

            //remove orders which are at destination, for the all options (also processes all orders)
            for(var i=0 ; i<current_in.length ; i++){
                remove_order(Fleet,m,i,visual_data,current_in);
            }

            //Store this state as an option in options array
            current_in=Fleet[visual_data[4]].route[m].options;
        }
    }

    //delete options array for next iteration/loop
    for(var j in Fleet[visual_data[4]].route){
        Fleet[visual_data[4]].route[j].options =[];
    }



    var s=find_best_option(reconfig_map(current_in)); //this is the selected option.

    //Check if the total volume of the orders, exceed the truck's volume at each stop
    for(var i=1; i<current_in[s].length ; i++ ){
        var totalvolthis = 0; //total volume of the truck at this stop
        for(var j=0 ; j<current_in[s][i].length ; j++){
            totalvolthis = totalvolthis + current_in[s][i][j].items_list.length ;
        }

        if(totalvolthis > (max_vol/(visual_data[5] * visual_data[5] * visual_data[5])) ){
            console.log ("exceed");
            return exceedflag =1;
        }
    }

    //Place the resulted data into correct arrays (Initial, final states of truck at each stop)

    //Example: New order's origin is stop-3
    // Route=>                                  stop-1   stop-2     stop-3(new item origin)  stop-4                          stop-5          stop-6
    //in_initial (initial state of the truck)    []       old       old                       stop-3.infinal=currentin[0]    currentin[1]    currentin[2]
    //in_final   (final state of the truck)      old      old       currentin[0]              currentin[1]                   currentin[2]    currentin[3] = []
    //stop(a).in_final= stop(a+1).in_initial //previous stop's final state is equal for this stop's inital state

    var loop_flag_1=0;
    var ii=0;
    for(var m in Fleet[visual_data[4]].route) {
        if ((incoming_order[0].origin == m && loop_flag_1 == 0) || (incoming_order[0].origin != m && loop_flag_1 == 1)) {
            loop_flag_1 = 1;

            if(ii==0){
                Fleet[visual_data[4]].route[m].in_initial = current_in[s][ii];
                ii++;
            }
            Fleet[visual_data[4]].route[m].in_final = current_in[s][ii];
            ii++;
        }
    }

    var loop_flag_2=0;
    var cou=0;
    for(var f in Fleet[visual_data[4]].route){
        if(incoming_order[0].origin == f && loop_flag_2 == 0){
            loop_flag_2 = 1;
            cou++; // cou=0 => current_in[s][0]= route.f.in_initial
                   // cou=1 => current_in[s][0]= route.f.in_final
        }

        if(incoming_order[0].origin !== f && loop_flag_2 == 1 ){

            Fleet[visual_data[4]].route[f].in_initial = current_in[s][cou];
            cou++;
        }
    }

    var flagme=0;
    var countme =1;

    for(var x in Fleet[visual_data[4]].route){

        if(incoming_order[0].origin == x){
            flagme++; //flagme=1
        }
        if(flagme == 2){
            Fleet[visual_data[4]].route[x].in_initial = current_in[s][countme];
            countme++;

        }
        else if(flagme==1){
            flagme++; //flagme=2
        }
    }



    //Create item/order placement points
    if((Fleet[visual_data[4]].positions.length == 0 || Fleet[visual_data[4]].pos_dest.length == 0)
        && emptycount !== 6){ //emptycount=6 means order is removed from truck and truck is empty, so dont create any points

        Fleet[visual_data[4]].positions=[]; // delete this, if below is empty and this one is not empty
        Fleet[visual_data[4]].pos_dest=[];  // delete this, if above is empty and this one is not empty
        create_positions(visual_data);
    }
}

//Order constructor
function order(origin, destination, customer /*, x,y,z */) {
    this.order_id = new Date().getTime() + Math.random();
    this.origin = origin; //pick-up location
    this.destination = destination;  //drop-off location
    this.status = "out";             //order status. Values are in, out or reconfig
    this.value = 0; // how many times order is rehandled
    this.customer = customer;
    this.items_list = [];
    this.color = '#'+ Math.floor(Math.random() * 16777216).toString(16);
}

//Item constructor
function item(h,w,l,o,d){

    this.id = new Date().getTime() + Math.random() + Math.random();
    this.x = h; //height
    this.y = w; //width
    this.z = l; //length
    this.origin=o;
    this.destination=d;
    this.volume = h*w*l;
}

//Drop-off the orders which arrived to the destination.
function remove_order(Fleet,m,i,visual_data,current_in){

    var remove_flag=0;
    finish_add_out_order_flag = 0;

    new_current_in=[]; //Orders inside the truck
    new_out=[]; //Orders outside the truck

    var newoutobj= JSON.parse(JSON.stringify(Fleet[visual_data[4]].route[m].out));// orders at pick-up zone (New orders)
    new_out=new_out.concat(newoutobj);

    // A same Javascript object with status property may exist in different arrays, however, when a status is modified
    // in one array, other arrays are affected too. Therefore, a new newoutobj is created

    //Orders at outside are placed into truck, change their status
    for(var ooo in new_out){
        if(new_out[ooo].status=="out"){
            new_out[ooo].status="in";
        }
    }

    //Iterate orders from far side to near side of the door of the truck.
    //If an order is at destination, remove it
    //if an order is blocking other orders remove it for reconfiguration (status=reconfig)
    //If an order doesn't block others and is not at destination, stays in the truck (status=in)
    for(var n in current_in[i][current_in[i].length-1]){
        if(current_in[i][current_in[i].length-1][n].destination != m && remove_flag==0){
            var copyobject1= Object.assign({}, current_in[i][current_in[i].length-1][n]);
            copyobject1.status="in";
            new_current_in.push(copyobject1);
        }
        if(current_in[i][current_in[i].length-1][n].destination != m && remove_flag==1){
            var copyobject= Object.assign({}, current_in[i][current_in[i].length-1][n]);
            new_out.push(copyobject);
            copyobject.status="reconfig";
            copyobject.value++;
        }
        if(current_in[i][current_in[i].length-1][n].destination == m){
            remove_flag=1;
        }
    }

    new_out.sort(compare); // Create LIFO structure for the orders at outside

    //Create first loading pattern option by merging orders outside and inside
    Fleet[visual_data[4]].route[m].options.push(current_in[i].concat([new_current_in.concat(new_out)]));

    //Check if the orders maintain LIFO structure in the container
    is_array_sorted (new_current_in.concat(new_out));

    // if there is an order outside for reconfig and the last pattern is not LIFO
    if(new_out.length >0 && finish_add_out_order_flag == 0){
        //remove the nearest order from the container, to create new loading pattern
        add_out_order(Fleet,m,i,visual_data,current_in);
    }
}

//Compare order destinations
function compare(a, b) {

    var genreA = a.destination;
    var genreB = b.destination;

    var comparison = 0;
    if (genreA > genreB) {

        comparison = -1;

    } else if (genreA < genreB) {

        comparison = 1;

    }
    return comparison;
}

//Remove the nearest order from the container, to create new loading pattern
function add_out_order(Fleet,m,i,visual_data,current_in){
    for(var j = new_current_in.length -1 ; j>0 ; j--){
        var copyobject= Object.assign({}, new_current_in[j]);
        new_out=new_out.concat(copyobject);
        copyobject.value++; //new_out[new_out.length-1].value++;
        copyobject.status="reconfig";

        new_out.sort(compare);// Create LIFO structures for the orders at outside
        new_current_in.splice(j,1);

        //Create new loading pattern
        Fleet[visual_data[4]].route[m].options.push(current_in[i].concat([new_current_in.concat(new_out)]));

        is_array_sorted (new_current_in.concat(new_out));

        if(finish_add_out_order_flag==1){
            return;
        }
    }
}

//Check if the orders maintain LIFO structure in the container
function is_array_sorted (A){
    var my_array= A;
    var a1=0;
    var a2=0;

    for (var i = 0; i < my_array.length - 1; i++) {
        if (my_array[i].destination < my_array[i + 1].destination) {
            a1++;
        }
        else {
            a2++;
        }
    }

    if(a2==my_array.length - 1){
        return finish_add_out_order_flag =1;
    }
}

//Create item placing positions at pick-up area. Items are waiting outside to be loaded into container
var points_out=[];
function create_pos_out(x){
    var h=parseInt(x);
    for( var k = (h/2) ; k <= 13.5*h  ; k+= h ){
        for( var j = (1.5*h) ; j >= (h/2)  ; j-= h ){
            for(var i = (2*x_container -(3*h/2)) ; i >= (1.5*x_container - h/2 ) ; i-= h){
                points_out.push([i+30,-h-j,k]);
            }
        }
    }
}

//Create item placing positions at reconfig area
var pos_rec=[];
function create_pos_rec(x){
    var h=parseInt(x);
    for( var j = (h/2) ; j <= (y_container - (h / 2) )  ; j+= h){
        for( var k = (h/2) ; k <= 4*h  ; k+= h){
            for(var i = (2.5*x_container - (3*h/2)) ; i >= (2*x_container - h/2 ) ; i-= h  ){
                pos_rec.push([i+15,j+1.5*y_container,k]);
            }
        }
    }
}

//Create item placing positions. pos=[ [i,j,k], [i,j,k], ...  ] in container
function create_positions (visual_data){
    var h = parseInt(visual_data[5]);
    for(var i = (h/2) ; i <= (x_container - (h / 2) ) ; i+= h ){
        for(var k = (h/2) ; k <= (z_container - (h / 2) ) ; k+= h ){
            for(var j = (h/2) ; j <= (y_container - (h / 2) ) ; j+= h ){
                Fleet[visual_data[4]].positions.push([i,j,k]);
            }
        }
    }

    //destination area placement points
    for( var j = (h/2) ; j <= (y_container - (h /2) )  ; j+= h){
        for( var k = (h/2) ; k <=5*h   ; k+= h){
            for(var i = (2.5*x_container - (3*h/2)) ; i >= (2*x_container - h/2) ; i-= h  ){
                Fleet[visual_data[4]].pos_dest.unshift([i+15,j,k]);
            }
        }
    }
}

//Generate a volume matrix. VM has all the options with delay rates.
function reconfig_map(a){

    var current_in=a;
    var tv =0; // total reconfig volume at a stop (sum of all reconfig orders' volume at this stop)
    var thisordervolume; //total volume of a reconfig order
    var second_Array=[]; //store each tv in this temporary array
    var volume_matrix = []; //This array has all options and their delay rates at each stop.

    /* example volume_matrix=
     [ [ 0, 0, 16, 16, 16, 0 ],        rows = options
     [ 0, 0, 16, 24, 0, 0 ],          columns = route/stops
     [ 0, 0, 24, 0, 16, 0 ],          values = total re-handled volume at a stop
     [ 0, 0, 32, 0, 0, 0 ],
     [ 0, 8, 0, 16, 16, 0 ],
     [ 0, 8, 0, 24, 0, 0 ],
     [ 0, 16, 0, 0, 16, 0 ],
     [ 0, 24, 0, 0, 0, 0 ] ]

     */

    //calculate total reconfig volume
    //i=options, j=stops, x=Orders
    for(var i=0; i<current_in.length ; i++){
        for(var j=0; j< current_in[i].length; j++){
            for(var x in current_in[i][j]) {
                if(current_in[i][j][x].status == "reconfig"){
                    thisordervolume = 0; //total volume of an order
                    for(var k in current_in[i][j][x].items_list){
                        thisordervolume = thisordervolume + current_in[i][j][x].items_list[k].volume;
                    }
                    tv= tv + thisordervolume;
                    // console.log("tv", tv);
                }
                else{
                    console.log("Order status ia not'reconfig' ", current_in[i][j][x].customer);
                }
            }
            second_Array.push(tv);
            tv=0;
        }
        volume_matrix.push(second_Array);
        second_Array=[];
    }
    return volume_matrix;
}

//This function finds the best option and create an index (my_option)
function find_best_option(a){

    var volumematrix=a;

    /* EXAMPLE
     var volumematrix=       [  // options are rows. each option has 6 routes, for example: (0-a-b-c-d-e).
     // numbers correspond to reconfig volume at each stop. Aim is to find the smallest volume (sum)
     [ 0, 0, 16, 16, 16, 0 ],  // sum 48   option 1,  route 0, a, b, c, d, e
     [ 0, 0, 16, 24, 0, 0 ],   // sum 40   option 2
     [ 0, 0, 24, 0, 16, 0 ],   // sum 40
     [ 0, 0, 32, 0, 0, 0 ],    // sum 32
     [ 0, 8, 0, 16, 16, 0 ],   // sum 40
     [ 0, 8, 0, 24, 0, 0 ],    // sum 32
     [ 0, 16, 0, 0, 16, 0 ]    // sum 32
     [ 0, 24, 0, 0, 0, 0 ]     // sum 24
     ];
     */

    var sum_VM = [] ; // volumematrix's sum of elements of each rows. example: [ 48, 40, 40, 32, 40, 32, 32 ]
    for(var i=0; i<volumematrix.length ; i++){
        sum_VM.push(sumArray(volumematrix[i])); //create [ 48, 40, 40, 32, 40, 32, 32 ]
    }

    var index_VM=[];  // index of sum_VM's smallest elements 32's are the smallest. their index are 3,5 and 6.
    for(var i=0; i<sum_VM.length; i++){ //this index is also the number of our result for option
        if(sum_VM[i]==Math.min(...sum_VM)){  // if min value equals to sum_VM element, push it's index (i)
            index_VM.push(i);
        }
    }

    var volumematrix_copy = JSON.parse(JSON.stringify(volumematrix)); // copy and modify this array.

    var cumulativedelay= [];//if there are multiple minimum value, put them here to compare their cumulative delay value
    var my_option; // min value of cumulativedelay

    //calculate cumulative delay for each option
    for(i in index_VM){  // index_VM=[3,5,6] and i=3,5,6
        for(var j=0; j<volumematrix_copy[index_VM[i]].length-1 ; j++){  // length-1 of volumematrix[3], [5], [6]
            //volumematrix[3][1] = volumematrix[3][1] + volumematrix[3][0]
            volumematrix_copy[index_VM[i]][j+1] = volumematrix_copy[index_VM[i]][j+1] + volumematrix_copy[index_VM[i]][j];
            // to find average delay caused by reconfig on the route
            // 3: [ 0, 0, 32, 0, 0, 0 ] --> [ 0, 0, 32, 32, 32, 32 ]
            // 5: [ 0, 8, 0, 24, 0, 0 ] --> [ 0, 8, 8, 32, 32, 32 ]
            // 6: [ 0, 16, 0, 0, 16, 0 ] --> [ 0, 16, 16, 16, 32, 32 ]
            //  first find total reconfig amount (sum_VM). Smallest element has smallest delay.
            //  if total reconfig amounts are smallest and same at multiple options, then compare average delay at each stop
        }

        cumulativedelay.push(sumArray(volumematrix_copy[index_VM[i]]) /volumematrix_copy[index_VM[i]].length);
        //cumulativedelay = [ Sum[0,0,32,32,32,32]/length, Sum[0,8,8,32,32,32]/length, Sum[0,16,16,16,32,32]/length ]   ]
    }

    my_option =index_VM[indexOfSmallest(cumulativedelay)];
// Put index of cumulativedelay's min element index_VM to find the index of minimum option
// index_VM keeps the index of same minimum value options
// current_in[x] = current_in [ my_option ]

    new_allreconfig=(sum_VM[my_option])/27;
    return my_option;

//this function returns my_option that will be used in current_in [ my_option ]
    function indexOfSmallest(a) {
        var lowest = 0;
        for (var i = 1; i < a.length; i++) {
            if (a[i] < a[lowest]) lowest = i;
        }
        return lowest;
    }

//Sum of elements in an array
    function sumArray(a) {

        var sum = 0;
        for (var i = 0; i < a.length; i++) {
            sum = sum + a[i]
        }
        return sum;
    }

}
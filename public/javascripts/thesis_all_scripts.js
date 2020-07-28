// TAB click and reveal information functionality
function openTAB(evt, tabb) {
        var i, tabcontent, tablinks;
        tabcontent = document.getElementsByClassName("tabcontent");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
        tablinks = document.getElementsByClassName("tablinks");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }
        document.getElementById(tabb).style.display = "block";
        evt.currentTarget.className += " active";
    }

//hide container checkbox
function hidecontainer(a){
        //it is better to use  if/else statement
        if (a.checked == true){
            scene.children[4].visible = false;
        }
        if (a.checked != true){
            scene.children[4].visible = true;
        }
    }

//Tab-1, remove. Send location to BE and receive item and truck list
var loc_r=0;
function gettrucklist(s) {

        document.getElementById('removeorder2').style.display = "block";
        loc_r = s[s.selectedIndex].id; //m when select an option from dropdown list, get id as string, socket emit
        socket.emit('tab1_remove_getitemtruck', loc_r ); //get items at out area and related trucks at this location
        loc_r=0;
    }

//Change color red-green-yellow
var current_color=[];
function swapcolor(){

        var checkbox = document.getElementById('swapcolor_id');
        if (checkbox.checked == true){
            for(var i=0; i<objects.length; i++){
                current_color.push(objects[i].material.color.getHex());
                if(objects[i].sta=="out"){
                    objects[i].material.color.setHex(16711680); //red
                }
                if(objects[i].sta=="destination"){
                    objects[i].material.color.setHex(32768); //green
                }
                if(objects[i].sta=="reconfig"){
                    objects[i].material.color.setHex(16776960); //yellow
                }
                if(objects[i].sta=="in"){
                    objects[i].material.color.setHex(8421504); //gray
                }

            }

        }

        if (checkbox.checked != true){
            for(var i=0; i<objects.length; i++){
                objects[i].material.color.setHex(current_color[i]);
            }
            current_color=[];
        }
    }

//Tab-2, get truck list
var loc;
function trucklist_tab2(s) {

        document.getElementById('dummy2').style.display = "none"; //dummy div for alignment
        document.getElementById('form_tab2').style.display = "block";
        document.getElementById("form_tab2").reset();
        objects = [];
        data=[];
        visual_data =[];
        initial_positons=[];
        counter_ip=0;
        loc = s[s.selectedIndex].id; // when select an option from dropdown list, get id as string, socket emit
        socket.emit('tab2_gettruck', loc ); //get trucks that is going/coming to selected location
    }

//Tab-2, animate
function t2_animation(){
    var i=objects.length-1;
    var counter=0;
    move_items(i);

    //move items
    function move_items(i){
        if(objects[i].sta=="destination"){
            counter++;
            var tween = new TWEEN.Tween(objects[i].position).to({x:objects[i].finalpos_x, y:objects[i].finalpos_y, z:objects[i].finalpos_z},100).start()
                .onComplete(function() {
                    if (i != 0) {
                        i--;
                        move_items(i);
                    }
                });
        }
        else if(objects[i].sta=="reconfig"){
            counter++;
            var tween = new TWEEN.Tween(objects[i].position).to({x:objects[i].posrec_x, y:objects[i].posrec_y, z:objects[i].posrec_z},100).start()
                .onComplete(function() {
                    if (i != 0) {
                        i--;
                        move_items(i);
                    }
                });
        }
        else if(objects[i].sta=="out" ){
            counter++;
            if (i != 0) {
                i--;
                move_items(i);
            }
            else {

                var ii=objects.length-counter;
                var k=0;
                move_reconfig(ii,k);

            }
        }
        else{
            if (i !== 0) {
                i--;
                move_items(i);
            }
            else{
                var ii=objects.length-counter;
                var k=0;
                move_reconfig(ii,k);
            }
        }
    }

    //move reconfig items into the truck
    function move_reconfig(ii,k){

        if(positions_i[ii][0]==objects[k].finalpos_x &&
            positions_i[ii][1]==objects[k].finalpos_y &&
            positions_i[ii][2]==objects[k].finalpos_z && ((objects[k].sta == "out") || (objects[k].sta == "reconfig")) ){

            var tween = new TWEEN.Tween(objects[k].position).to({x:objects[k].finalpos_x, y:objects[k].finalpos_y, z:objects[k].finalpos_z},100).start()
                .onComplete(function() {
                    if (ii != objects.length) {
                        ii++;
                        k=0;
                        move_reconfig(ii,k);
                    }
                });
        }

        else {
            k++;
            if (k == objects.length) {
                k=0;
                ii++;
            }

            if (ii != objects.length) {
                move_reconfig(ii,k);
            }

        }
    }
}

//Selecting a truck and drawing objects in tab 2
document.mainForm_tab2.onclick = function() {
        document.getElementById('swapcolor_id').checked = false;
        current_color = [];
        objects = [];
        data=[];
        visual_data =[];
        initial_positons=[];
        counter_ip=0;
        var truck_tab2 = document.querySelector('input[name = truckss2]:checked').value;
        var loc_truck=[loc, truck_tab2];


        for(var ii=scene.children.length-1; ii>4; ii--  ){  // deletes cube and its control
            scene.remove(scene.children[ii]);
        }

        socket.emit('tab2_loadingplans', loc_truck);
    };

    var socket = io();
    var initial_positons=[];
    var counter_ip=0;
    var control;
    var objects = [];
    var objects2=[];
    var objects3=[];
    var data=[]; //send origin, destination to server, to find trucks
    var visual_data =[]; // data + amount,truckname,dimensions

//search available trucks, bring truck list in tab 1
document.mainForm.onclick = function() {
        visual_data[4] = document.querySelector('input[name = truckss]:checked').value;
    };

//Reset position button
function myReset() {
        for(var i=0 ; i<initial_positons.length ; i++){
            objects[i].position.x=initial_positons[i][0];
            objects[i].position.y=initial_positons[i][1];
            objects[i].position.z=initial_positons[i][2];
        }
    }

// Reset Menu, Delete content
function myDelete() {
        for(var i=0; i<5000 ; i++){ //5000 must replaced with pos.length
            scene.remove(scene.getObjectByName("mycube"));
        }
        document.getElementById('form').style.display = "none";    // hide truck area
        document.getElementById("form").reset();  //uncheck selcted radio button
        document.getElementById('add_order').style.display = "none";  //hide item add part
        document.getElementById("visual_data[3]").value="amount";     //initial values
        document.getElementById("visual_data[5]").value="dimension";
        document.getElementById("or1").selectedIndex = 0;
        document.getElementById("des1").selectedIndex = 0;
        document.getElementById("removeorder1").selectedIndex = 0;
        document.getElementById('removeorder2').style.display = "none";
        document.getElementById("change_chart").selectedIndex = 0;
        document.getElementById('form_tab2').style.display = "none";
        document.getElementById('dummy2').style.display = "block"; //make dummy div visible for alignment
        document.getElementById("mydata[2]").value="name";
        document.getElementById('add_order11').style.display = "none"; //1 unit=40cm
        //1= light 2=axis helper 3= grid helper 4=cube 5=cube control 6=another cube 7=another cube control
        for(var ii=scene.children.length-1; ii>4; ii--  ){  // deletes cube and its control
            scene.remove(scene.children[ii]);
        }
        alert("Deleted");
        objects = [];
        data=[];
        visual_data =[];
        initial_positons=[];
        counter_ip=0;
    }

// Visualize Order button t1
    function visualizeOrder(){
        visual_data[0]=data[0]; //origin
        visual_data[1]=data[1]; //destination
        visual_data[2]=data[2]; //customer name
        visual_data[3] = document.getElementById("visual_data[3]").value;   //amount
        //visual_data[4] = document.getElementById("visual_data[4]").value; //truck name
        visual_data[5] = document.getElementById("visual_data[5]").value;  //x
        //visual_data[6] = document.getElementById("visual_data[6]").value;  //width disabled
        //visual_data[7] = document.getElementById("visual_data[7]").value;  //height disabled
        socket.emit('visualize_data', visual_data);
    }

// user selected origin location at tab1
    function getOrigin(a) {
        //origin
        data[0] =document.getElementById(a[a.selectedIndex].id).id
    }

// user selected destination location at tab1
    function getDestination(b) {
        data[1] =document.getElementById(b[b.selectedIndex].id).id
    }

    //search available truck, Tab1
    function availableTruck(){
        document.getElementById('form').style.display = "block";  // display truck area
        //data[0] = document.getElementById("mydata[0]").value;
        //data[1] = document.getElementById("mydata[1]").value;
        data[2] = document.getElementById("mydata[2]").value;
        socket.emit('trucklist', data );
    }

//Display menu after availableTruck() selected, tab1
    function showDiv() {
        document.getElementById('add_order').style.display = "grid";
        document.getElementById('add_order1').style.display = "grid"; //dummy div for alignment
        document.getElementById('add_order11').style.display = "grid"; //1 unit=40cm
    }

//Display new order at tab1
    function showDiv2() {
        document.getElementById('neworder').style.display = "grid";
        document.getElementsByClassName("tablinks1")[0].className="tablinks1 active";
        document.getElementsByClassName("tablinks1")[1].className="tablinks1";
        document.getElementById('removeorder').style.display = "none";
    }

//Display remove order at tab1
    function showDiv3() {
        document.getElementById('removeorder').style.display = "grid";
        document.getElementsByClassName("tablinks1")[1].className="tablinks1 active";
        document.getElementsByClassName("tablinks1")[0].className="tablinks1";
        document.getElementById('neworder').style.display = "none";
    }

// save file
    function mySave() {
        socket.emit('savefile');
        alert("Order saved")
    }

// Tab2, if user selects an empty truck
    var positions_i; //position points
    socket.on('position_cont', function (a) {
        if(a==0){ // File is empty
            alert("Empty Truck");
        }
        else{
            positions_i=a;
        }
    });

// Tab2, if selected truck is not empty, create objects with the information
    socket.on('items', function (lll) {

        Myitem(lll[0],lll[1],lll[2],lll[3][0],lll[3][1],lll[3][2],lll[4],lll[5],lll[6],
                lll[7],lll[8][0],lll[8][1],lll[8][2],lll[9][0],lll[9][1],lll[9][2],lll[10]);
        // itemid, h, order_color, [initial pos], o, d, c, orderid, [pos_rec], [final_pos], final_status
        initial_positons.push([objects[counter_ip].position.x,objects[counter_ip].position.y,objects[counter_ip].position.z]);
        counter_ip++;
    });

//Tab-1, delay rate
 socket.on('delay_rate', function (dr) {
     document.getElementById( 'delay_rate').value = dr.toFixed(2);
 });


////////////////////////////// THREE.JS PART ////////////////////////////////

    var canvaswidth= 1450;
    var canvasheight= 910;
    var container = document.getElementById( 'display_area' );

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera( 75, canvaswidth / canvasheight, 0.1, 1000 );

    camera.position.z = 15;
    camera.position.y = 5;
    camera.position.x = 5;
    camera.up = new THREE.Vector3( 0, 0, 1 );

    var renderer = new THREE.WebGLRenderer();
    renderer.setClearColor( 0x36396E );
    renderer.setSize( canvaswidth, canvasheight ); // (window.innerWidth, window.innerHeight)
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;

    container.appendChild( renderer.domElement );

    controls = new THREE.OrbitControls(camera, renderer.domElement);

    var ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.2);
    var textureLoader= new THREE.TextureLoader();
    var createTexture= textureLoader.load("./wood2.png");

    //Load container
    var oStlLoader = new THREE.STLLoader();
    oStlLoader.load('javascripts/Thesis-container.stl', function(geometry) {
        geometry.center();
        var material = new THREE.MeshPhongMaterial();
        var mesh = new THREE.Mesh(geometry, material);

        mesh.rotation.set( 0, 0, Math.PI / 2);
        mesh.position.set(17.55, 3, 3.45);
        mesh.scale.set(0.003, 0.003, 0.003);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        scene.add(mesh);
    });

    //Floor
    var Floormesh = new THREE.Mesh(
            new THREE.PlaneGeometry(100,100,100,10),
            new THREE.MeshPhongMaterial({color: 0xb9b9b9, wireframe:false}) //0xb9b9b9
    );
    Floormesh.receiveShadow = true;
    Floormesh.position.set(45, 0, 0);
    scene.add(Floormesh);

    var light; //pointlight for shadow creation
    light= new THREE.PointLight(0xffffff, 1, 0);
    light.position.set(30,30,30);
    light.castShadow =true;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 100;

    scene.add(light);
    scene.add(ambientLight);

    var gridXY = new THREE.GridHelper(100, 100);
    gridXY.position.set(0,0,0);
    gridXY.rotation.x = Math.PI/2;

    //render graphics
    var render =function () {
        control.update();
        renderer.render( scene, camera );
    };

    //animation
    var animate = function () {
        if (objects3.length != 0) {
            for(var i=0 ; i<objects3.length ; i++) {
                socket.emit('tab3_movement', [i, objects3[i].position.x, objects3[i].position.y, objects3[i].position.z]);
            }
        }
        requestAnimationFrame( animate );
        TWEEN.update();
        render();
    };

    //Draw objects including information
    function Myitem(itemid, height, color, position_in_x,position_in_y,position_in_z, o, d, c, oi,
                    position_rec_x,position_rec_y,position_rec_z,
                    position_final_x,position_final_y,position_final_z, sta ){
        // itemid, h, order_color, [initial pos], origin, dest, customer, orderid, [final_pos], final_status

        var geometry = new THREE.BoxGeometry( height, height, height );  //dimensions of a cube
        createTexture=  textureLoader.load("javascripts/wood2.png");

        //at tab1, added items are opac. at tab 2, data[0] (origin) is undefined
        if(o===data[0] && o !== 'undefined'  && data[0] !== 'undefined'){
            var material1 = new THREE.MeshPhongMaterial( { color: color , transparent: true, opacity: 1, map : createTexture,  wireframe: false} );
            var material=material1;
        }

        else if(d===loc && d !== 'undefined'  && loc !== 'undefined'){
            var material2 = new THREE.MeshPhongMaterial( { color: color , transparent: true, opacity: 1, map : createTexture,  wireframe: false} );
            var material=material2;
        }

        else if(o===loc && o !== 'undefined'  && loc !== 'undefined'){ // tab2, out item is opac
            var material3 = new THREE.MeshPhongMaterial( { color: color , transparent: true, opacity: 1, map : createTexture,  wireframe: false} );
            var material=material3;
        }

        else if(position_rec_y !== 0 && position_rec_y !== 'undefined' ){ //tab2, reconfig item has "...y", opac
            var material4 = new THREE.MeshPhongMaterial( { color: color , transparent: true, opacity: 1, map : createTexture,  wireframe: false} );
            var material=material4;
        }

        else{
            var material5 = new THREE.MeshPhongMaterial( { color: color , transparent: true, opacity: 0.25, map : createTexture,  wireframe: false} );
            var material=material5;
        }

        //create cube
        var cube = new THREE.Mesh( geometry, material );
        cube.receiveShadow = true;
        cube.castShadow = true;
        cube.name= "mycube";
        cube.cubeid= itemid;   //new Date().getTime() + Math.random();

        //current position
        cube.position.x=position_in_x;
        cube.position.y=position_in_y;
        cube.position.z=position_in_z;

        //initial position
        cube.initialx=position_in_x;
        cube.initialy=position_in_y;
        cube.initialz=position_in_z;

        //reconfig position
        cube.posrec_x=position_rec_x;
        cube.posrec_y= position_rec_y;
        cube.posrec_z=position_rec_z;

        //final position
        cube.finalpos_x=position_final_x;
        cube.finalpos_y= position_final_y;
        cube.finalpos_z=position_final_z;

        cube.orj=o; //origin
        cube.des=d; //destination
        cube.orj2="-";  // translate cube.orj= o  to cube.orj2= Helsinki. This is used in infobox. This was an early design mistake
        cube.des2="--";

        if (cube.orj == "o") {
            cube.orj2 = "Helsinki";
        }
        if (cube.des == "o") {
            cube.des2 = "Helsinki";
        }
        if (cube.orj == "a") {
            cube.orj2 = "Porvoo";
        }
        if (cube.des == "a") {
            cube.des2 = "Porvoo";
        }
        if (cube.orj == "b") {
            cube.orj2 = "Lahti";
        }
        if (cube.des == "b") {
            cube.des2 = "Lahti";
        }
        if (cube.orj == "c") {
            cube.orj2 = "Tampere";
        }
        if (cube.des == "c") {
            cube.des2 = "Tampere";
        }
        if (cube.orj == "d") {
            cube.orj2 = "Pori";
        }
        if (cube.des == "d") {
            cube.des2 = "Pori";
        }
        if (cube.orj == "e") {
            cube.orj2 = "Kuopio";
        }
        if (cube.des == "e") {
            cube.des2 = "Kuopio";
        }
        if (cube.orj == "f") {
            cube.orj2 = "Vaasa";
        }
        if (cube.des == "f") {
            cube.des2 = "Vaasa";
        }
        if (cube.orj == "g") {
            cube.orj2 = "Oulu";
        }
        if (cube.des == "g") {
            cube.des2 = "Oulu";
        }
        if (cube.orj == "h") {
            cube.orj2 = "Rovaniemi";
        }
        if (cube.des == "h") {
            cube.des2 = "Rovaniemi";
        }

        cube.cus=c; //customer
        cube.orderid=oi; //order id
        cube.sta=sta; //status
        objects.push( cube );
        scene.add( cube );

        control = new THREE.TransformControls( camera, renderer.domElement );
        control.addEventListener( 'change', render );
        scene.add( control );

    }

    //mouse click
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();
    var INTERSECTED;

    //Highlight item
    function onDocumentMouseMove( event ) {

        mouse.x = ( ( event.clientX - container.offsetLeft ) / renderer.domElement.clientWidth ) * 2 - 1;
        mouse.y = - ( ( event.clientY - container.offsetTop ) / renderer.domElement.clientHeight ) * 2 + 1;

        raycaster.setFromCamera( mouse, camera );

        var intersects = raycaster.intersectObjects( objects );

        if ( intersects.length > 0 ) {
            if ( INTERSECTED != intersects[ 0 ].object ) {
                if ( INTERSECTED ) {
                    INTERSECTED.material.emissive.setHex( INTERSECTED.currentHex );
                }

                INTERSECTED = intersects[ 0 ].object;
                control.attach( intersects[ 0 ].object );
                INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex();

                document.getElementById("Customer").value    = intersects[ 0 ].object.cus;
                document.getElementById("Origin").value      = intersects[ 0 ].object.orj2;
                document.getElementById("Destination").value = intersects[ 0 ].object.des2;
                document.getElementById("Item ID").value     = intersects[ 0 ].object.cubeid;
                document.getElementById("Order ID").value    = intersects[ 0 ].object.orderid;
                document.getElementById("Item status").value = intersects[ 0 ].object.sta;

                INTERSECTED.material.emissive.setHex( 0xff0000 );
            }

        } else {

            if ( INTERSECTED ) {
                INTERSECTED.material.emissive.setHex( INTERSECTED.currentHex );
                control.detach( INTERSECTED );
                document.getElementById("Customer").value    = "";
                document.getElementById("Origin").value      = "";
                document.getElementById("Destination").value = "";
                document.getElementById("Item ID").value     = "";
                document.getElementById("Order ID").value    = "";
                document.getElementById("Item status").value = "";
            }

            INTERSECTED = null;
        }
    }

    document.addEventListener( 'mousemove', onDocumentMouseMove, false );

    //hide/show x,y,z axis on objects
    document.addEventListener( 'keydown', function ( event ) {

        switch ( event.keyCode ) {
            case 88: // X
                control.children[0].children[0].children[0].visible = ! control.children[0].children[0].children[0].visible;
                control.children[0].children[0].children[1].visible = ! control.children[0].children[0].children[1].visible;
                control.children[0].children[0].children[2].visible = ! control.children[0].children[0].children[2].visible;
                control.children[0].children[0].children[3].visible = ! control.children[0].children[0].children[3].visible;
                control.children[0].children[0].children[4].visible = ! control.children[0].children[0].children[4].visible;
                control.children[0].children[0].children[5].visible = ! control.children[0].children[0].children[5].visible;
                control.children[0].children[0].children[6].visible = ! control.children[0].children[0].children[6].visible;
                control.children[0].children[0].children[7].visible = ! control.children[0].children[0].children[7].visible;
                control.children[0].children[0].children[8].visible = ! control.children[0].children[0].children[8].visible;
                control.children[0].children[0].children[9].visible = ! control.children[0].children[0].children[9].visible;
                break;

            case 89: // Y
                control.children[0].children[0].children.visible = false;
                control.showY = ! control.showY;
                break;

            case 90: // Z
                control.children[0].children[0].children.visible = false;
                control.showZ = ! control.showZ;
                break;
        }
    } );

    Myitem(4,0,0xFF0000,9,3,3,"a","b", "customer0","o1",0,0,0,1,2,3,"sta");
    myDelete();

    //Draw objects in Tab-3, for real-time collaborative environment
    function Myitem2(xx,yy,zz,color) {
        var geometry = new THREE.BoxGeometry(xx, yy, zz);  //dimensions of cube
        createTexture=  textureLoader.load("javascripts/wood2.png");
        var material = new THREE.MeshPhongMaterial({
            color: color,
            transparent: true,
            opacity: 1,
            map: createTexture,
            wireframe: false
        });

        var cube2 = new THREE.Mesh( geometry, material );
        cube2.position.set(1, 1, 1);

        objects3.push(cube2);
        scene.add( cube2 );

        control = new THREE.TransformControls( camera, renderer.domElement );
        control.addEventListener( 'change', render );
        control.attach( cube2 );
        scene.add( control );

    }

    //Send add item parameters to other clients
    function tab3_additem(a,b,c,d){
        Myitem2(a,b,c,d);
        socket.emit('tab3_add', [a,b,c,d]);
    }

    //Tab-3, other client added an object. Receive other client's object information
    socket.on('tab3_sendadded', function (m) {
        Myitem2(m[0],m[1],m[2],m[3]);
    });

   // Receive real-time movement information update
    socket.on('tab3_sendmove', function (n){
        for(var i=0; i<objects3.length; i++){
            objects3[n[0]].position.x=n[1];
            objects3[n[0]].position.y=n[2];
            objects3[n[0]].position.z=n[3];
        }
    });

    //Tab-3 send Flag state
	    function status(a){
        var flagvalue;
        if (a.checked == true){
            flagvalue=0;
            document.getElementById("status2").disabled = false;
        }
        if (a.checked != true){
            flagvalue=1;
            document.getElementById("status2").disabled = true;
        }
        socket.emit('tab3_status', flagvalue )
    }

    //Tab-3 disable/enable menu, change status
    socket.on('other_status', function (a) {
        if(a==0){ // someone is busy, disable button and change flag color to red
            //disable checkbox
            //disable add item
            document.getElementById("status").disabled = true;
            document.getElementById("status2").disabled = true;
            document.getElementById('flag').style.backgroundColor = "#ff0000" ;
            document.getElementById("flag").innerHTML = "Busy";
        }
        else{
            document.getElementById("status").disabled = false;
            document.getElementById("status2").disabled = true;
            document.getElementById('flag').style.backgroundColor = "#00ff00" ;
            document.getElementById("flag").innerHTML = "Available";
        }
    });

    //Database is modified by another user
    socket.on("db_message", function (abc) {
     //Database is modified by another user
     alert(abc);
    });

    //exceed item
    socket.on('exceed', function () {
     alert("EXCEED");
     myDelete();
    });

    animate();

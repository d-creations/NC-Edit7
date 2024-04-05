/**
 * autor : roth 
 * date : 2024
 * 
 * IDEAdapter 
 * 
 * A CNC Editor for multiply Canals  
 *              it uses a 3dView to plot proram code 
 *              e Console to print CNC Program errors for the User
*               
* Lizenz:
* MIT License

Copyright (c) 2024 damian-roth Switzerland

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

* 
 */





import * as THREE from "../technicalService/build/three.module.js";

import {OrbitControls} from '../technicalService/build/OrbitControls.js';

import {TransformControls} from '../technicalService/build/TransformControls.js';

import {TrackballControls} from '../technicalService/build/TrackballControl.js';

import Stats from '../technicalService/build/stats.module.js';



export class View3D{

     static scene;
     static camera;
     static controls;


    constructor() {



        let DView = document.getElementById("DView");
        var container = document.getElementById('container');
        const fov = 75;
        const aspect = 2;  // the canvas default
        const near = 0.1;
        const far = 200;
        const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        camera.position.z = 50;
        camera.position.x = 0;
        camera.position.y = 0;

        window.scene = new THREE.Scene();
        scene.background = new THREE.Color(0xF5F5F5);
        let coordinateSystem = new CoordinateSystem(scene)
        coordinateSystem.create()

        const color = 0xFFFFFF;
        const intensity = 1;
        const light = new THREE.DirectionalLight(color, intensity);
        light.position.set(-1, 2, 10);
        scene.add(light);

        window.renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(DView.clientWidth, (DView.clientHeight-100));
        renderer.shadowMap.enabled = true;
        document.body.appendChild( renderer.domElement );
  

        this.camera = camera;
        // Controls
        // Controls  Anymation and animationfram 

        View3D.controls = new TrackballControls( camera, renderer.domElement );
        View3D.controls.rotateSpeed = 2.3;
        View3D.controls.zoomSpeed = 2.9;
        View3D.controls.panSpeed = 1.0;
        View3D.controls.keys = [ 'KeyA', 'KeyS', 'KeyD' ];
        animate()
        
        function animate() {
        requestAnimationFrame( animate );
        View3D.controls.update();
        render();
        }
        function render() {
            renderer.render(scene, camera);
        }

     





        container.appendChild(renderer.domElement);
        this.ploT = new Plot(this.scene)

    }

    clearPlot(){
        this.ploT.clearPlot()
        this.reload()

    }

    clearSinglePlot(){
        this.ploT.clearSinglePlot()
        this.reload()
    }

    
    setPointRadius(raduis){
            let num = Number(raduis)
            if(num != NaN){
                this.ploT.radius = raduis;
                this.ploT.clearSinglePlot()
                this.reload
        }
    }



    plot(lines){
        this.ploT.plot(lines) 
        this.reload()
    }

    plotSingle(lines){

        this.ploT.plotSingle(lines)
        this.reload()
    } 

    reload(){

        var camera = this.camera;
        render();
        function render() {
            renderer.render(window.scene, camera);
       }
    } 

    viewChange(view){
        if (view == "F_G18"){
            View3D.controls.reset()
            View3D.controls.rotateManual(new THREE.Vector3(1,1,-1),0.13)
        }
        else if(view == "F_G17"){
            View3D.controls.reset()
            View3D.controls.rotateManual(new THREE.Vector3(4.35,4,-0.65),0.06)
        }
        else if(view == "F_G19"){
            View3D.controls.reset()
            View3D.controls.rotateManual(new THREE.Vector3(0,1,0),0.181)
        }
        else{
            View3D.controls.reset()

        }
    } 
}

class Plot{



        static scene


        static radius = 0.2

    constructor(_scene){
        this.scene = _scene

        this.plotGeometry = [new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,0)])];
        this.plotSingleGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,0)]);
        this.plotSingleCube = new THREE.Line(this.plotGeometry[0], this.plotMaterial);

        this.plotMaterial = new THREE.LineBasicMaterial( { color: 0x000000 } );       
        this.plotSingleMaterial = new THREE.LineBasicMaterial( { color: 0x000FFF, linewidth : 1 } );  
        this.plotCube = [new THREE.Line(this.plotGeometry[0], this.plotMaterial)];
        this.sphereSinglegeometry = new THREE.SphereGeometry( this.radius, 8, 8 ); 
        this.sphereSinglematerial = new THREE.MeshBasicMaterial( { color: 0x000FFF } ); 
        this.sphereSingle = new THREE.Mesh( this.sphereSinglegeometry, this.sphereSinglematerial );



    } 

    clearPlot(){
        while(this.plotCube.length > 0){
            window.scene.remove(this.plotCube.pop())
        }
        while(this.plotGeometry.length > 0){
            this.plotGeometry.pop().dispose()

        }
    }

    clearSinglePlot(){
        window.scene.remove(this.plotSingleCube)
        this.plotSingleGeometry.dispose()        
        window.scene.remove(this.sphereSingle)
    }




    plot(lines){
        //const geometry = new THREE.CylinderGeometry(2,2,10,32);
        this.clearSinglePlot()
        const points = [];
        let point_index = 0;
        while(lines.x.length > point_index){
            points.push(new THREE.Vector3(lines.x[point_index],lines.y[point_index],lines.z[point_index]));
            point_index++

        }
        let newLength = this.plotGeometry.push(new THREE.BufferGeometry().setFromPoints(points));
        let newLengthPlot = this.plotCube.push(new THREE.Line(this.plotGeometry[newLength-1], this.plotMaterial));

    
        window.scene.add(this.plotCube[newLengthPlot-1]);
 
    }

    plotSingle(lines){
        this.clearSinglePlot()
        const points = [];
        for(let line of lines){
            let point_index = 0;
        while(line.x.length > point_index){
                points.push(new THREE.Vector3(line.x[point_index],line.y[point_index],line.z[point_index]));
                point_index++
            }
        }
        this.plotSingleGeometry = new THREE.BufferGeometry().setFromPoints(points);
        this.plotSingleCube  = new THREE.Line(this.plotSingleGeometry, this.plotSingleMaterial);

        this.sphereSinglegeometry = new THREE.SphereGeometry( this.radius, 8, 8 ); 
        this.sphereSinglematerial = new THREE.MeshBasicMaterial( { color: 0x000FFF } ); 

        this.sphereSingle = new THREE.Mesh( this.sphereSinglegeometry, this.sphereSinglematerial );
        if(points.length > 0){

        let point = points[points.length-1]
        this.sphereSingle.position.set(point.x, point.y, point.z )

        window.scene.add(this.sphereSingle);

        } 

        window.scene.add(this.plotSingleCube);
        }
    

}
 



class CoordinateSystem{


    static scene



    constructor(_scene){
        this.scene = _scene

    } 










    create(x,y,z){ 


        const geometryX = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(10,0,0)]);
        const materialX = new THREE.LineBasicMaterial( { color: 0xff0000 } );       
        const cuX = new THREE.Line(geometryX, materialX);
        scene.add(cuX);

        const geometryXLetter1 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(10,-1,0),new THREE.Vector3(12,1,0)]);
        const cuXLetter1 = new THREE.Line(geometryXLetter1, materialX);
        scene.add(cuXLetter1);
        const geometryXLetter2 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(10,1,0),new THREE.Vector3(12,-1,0)]);
        const cuXLetter2 = new THREE.Line(geometryXLetter2, materialX);
        scene.add(cuXLetter2);



        const geometryY = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,10,0)]);
        const materialY = new THREE.LineBasicMaterial( { color: 0xff0000 } );       
        const cuY = new THREE.Line(geometryY, materialY);
        scene.add(cuY);
        const geometryYLetter1 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,11,0),new THREE.Vector3(0,12,0)]);
        const cuYLetter1 = new THREE.Line(geometryYLetter1, materialY);
        scene.add(cuYLetter1);
        const geometryYLetter2 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,12,0),new THREE.Vector3(1,13,0)]);
        const cuYLetter2 = new THREE.Line(geometryYLetter2, materialY);
        scene.add(cuYLetter2);
        const geometryYLetter3 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,12,0),new THREE.Vector3(-1,13,0)]);
        const cuYLetter3 = new THREE.Line(geometryYLetter3, materialY);
        scene.add(cuYLetter3);


        const geometryZ = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,10)]);
        const materialZ = new THREE.LineBasicMaterial( { color: 0xff0000 } );       
        const cuZ = new THREE.Line(geometryZ, materialZ);
        scene.add(cuZ);







        const geometryZLetter1 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-1,11),new THREE.Vector3(0,-1,12)]);
        const cuZLetter1 = new THREE.Line(geometryZLetter1, materialZ);
        scene.add(cuZLetter1);
        const geometryZLetter2 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,1,11),new THREE.Vector3(0,1,12)]);
        const cuZLetter2 = new THREE.Line(geometryZLetter2, materialZ);
        scene.add(cuZLetter2);
        const geometryZLetter3 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-1,11),new THREE.Vector3(0,1,12)]);
        const cuZLetter3 = new THREE.Line(geometryZLetter3, materialZ);

        scene.add(cuZLetter3)
    } 
    
    
    
}

import {View3D} from "./view3d.js";
import {IDE} from "./IDE.js";
import {FileHandler} from ".//filehandler.js";  
import {IDEView} from "./IDEView.js"  ;
import {IDEAdapter} from "./IDEAdapter.js";  
import { Canal } from "./canal.js";
import { NCToolManagerCreator } from "./NCToolManager.js";
import {MachineAdapter} from "./machines/MachineAdapter.js"
import {Machine_Star} from "./machines/Machine_Star.js"
import { NCVariableManagerCreator } from "./NCVariableManager.js";
import { MachineManager } from "./MachineManager.js";
import { MachineManagerAdapter } from "./MachineManagerAdapter.js";
import { UserError } from '../technicalService/error/userError.js';


window.onload = function () {

    let printConsole = new UserError()
    var view3d = new View3D();
    var canalCreation = function(id, view3d, parentDiv,readOnly,timeLine){
        return new Canal(id, view3d, parentDiv,readOnly,timeLine)
    }
    let machineAdapter = new MachineAdapter(new Machine_Star(printConsole))
    let machineManagerAdapter = new MachineManagerAdapter(new MachineManager())
    machineManagerAdapter.setMaschine(machineAdapter)
    let toolManager = new NCToolManagerCreator(60,printConsole)
    let variableManager = new NCVariableManagerCreator(60,printConsole)

    let IDEcontroller = new IDE(document.getElementById("editor"),2,view3d,printConsole,canalCreation,toolManager,variableManager,machineManagerAdapter)
    let IDEadaptar = new IDEAdapter(IDEcontroller)
    let ideview = new IDEView(document.getElementById("editor"),IDEadaptar, 2,view3d,printConsole);
    new FileHandler(IDEadaptar, document.getElementById("fileHandler"), ideview,printConsole);
}
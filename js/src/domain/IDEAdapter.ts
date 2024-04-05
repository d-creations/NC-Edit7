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

import {CanalAdapter} from './canalAdapter.js';
import {ExampleCreator} from '../technicalService/ExampleCreator.js';
import {ViewObjectCreator} from '../technicalService/ViewObjectCreator.js';
import { NCToolManager, NCToolManagerCreator } from "./NCToolManager.js";
import {IDE} from './IDE.js';
import { Observable, Observer } from '../technicalService/observer.js';


export class IDEAdapter  implements Observer{
    getCalcTime(): string {
        return this.IDEController.getCalcTime()
    }


    IDEController : IDE

/**
 * 
 * @param parentDiv   HTML DIV FOR THE EDITOR
 * @param canalCount  Count of Canals 
 * @param view3d      3D View for th Plot
 * @param printConsole Print error and Info messages for the USER 
 */
    constructor(IDEController : IDE) {
        this.IDEController = IDEController
    }

    addViewObserver( observer : Observer) {
        this.IDEController.addObserver(observer);
        } 

/**
 * update for the obsever
 */
    public OberverUpdate(): void {
        this.IDEController.OberverUpdate()
    }
    public clearPlot(){
        this.IDEController.clearPlot()
    }
    removeSpaceCanal(canal : number) {
        this.IDEController.removeSpaceCanal(canal)
    }

    openSearchBox(canal: number){
        this.IDEController.openSearchBox(canal)
    }
    addSpaceCanal(canal : number) {
        this.IDEController.addSpaceCanal(canal)
    }
    redoCanal(canal : number) {
        this.IDEController.redoCanal(canal)
    }
    undoCanal(canal : number) {
        this.IDEController.undoCanal(canal)
    }
    controllListCanal(canal: number): string[] {
        return this.IDEController.controlListCanal(canal)
    }
    setSelectedMachineS(canal: number, machineName: string) {
        this.IDEController.setSelectedMachine(canal,machineName)
    }
    setTextToCanal(canalIndex: number, text: string) {
        this.IDEController.setTextToCanal(canalIndex,text)
    }
    controlListMachine(): string[] {
        return this.IDEController.controlListMachine()
    }
    
    createIDE(canalDiv : HTMLDivElement[],canalExecDiv : HTMLDivElement[], toolManagerDiv : HTMLDivElement[],varManagerDiv : HTMLDivElement[]) {
        this.IDEController.createIDE(canalDiv, canalExecDiv,toolManagerDiv,varManagerDiv )
    }
    getCanalKeyElementList(canal: number) {
        return this.IDEController.getCanalKeyList(canal)
    }
    sync_waitCode() {
        return this.IDEController.sync_waitCode()
    }
    sync_scroll() {
        this.IDEController.sync_scroll();
    }
    setTimeLineVisible(checked: boolean) {
        this.IDEController.setTimeLineVisible(checked)
    }
    loadExampleProgram(): any {
        this.IDEController.loadExampleProgram()
    }
    allCanalClear(): any {
        this.IDEController.allCanalClear();
    }


    public sync_scrollOff() {
        this.IDEController.sync_scrollOff()
    }

    public sync_waitCodeOff() {
        this.IDEController.sync_waitCodeOff()
    }

    public plotCNCCode(view3d,printConsole,canalcountList) {
        this.IDEController.plotCNCCode(view3d,printConsole,canalcountList)
    }

    

}









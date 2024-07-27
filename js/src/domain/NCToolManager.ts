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

import { UserError } from '../technicalService/error/userError.js';
import { Observable } from '../technicalService/observer.js';
import { ToolGeometrie } from './machines/MachineAdapter.js';

export class NCToolManagerCreator{
    countOfTools: number
    printConsole: UserError

    
/**
 * 
 * @param countOfTools 
 * @param printConsole 
 */
    constructor(countOfTools: number, printConsole: UserError) {
        this.countOfTools = countOfTools
        this.printConsole = printConsole
        
    }
    createToolManager(){
        return new NCToolManager(this.countOfTools,this.printConsole)
    }
}

export class NCToolManager extends Observable{
    private table: HTMLTableElement
    countOfTools: number
    printConsole: UserError
    radiusList : HTMLSpanElement[] = []
    quadrantList : HTMLSpanElement[] = []
    

    
/**
 * 
 * @param countOfTools 
 * @param printConsole 
 */
    constructor(countOfTools: number, printConsole: UserError) {
        super()
        this.table = document.createElement('table')
        this.countOfTools = countOfTools
        this.printConsole = printConsole
        this.createTable()
    }

    appendTableTo(parentDiv: HTMLDivElement){
        let div = document.createElement("div")
        parentDiv.appendChild(div)
        div.classList.add("toolManagerDiv")
        
        this.table.classList.add("toolManagerTable")
        div.appendChild(this.table)

    }

    public getToolFile() : ToolGeometrie[]{
        let toolGeometries : ToolGeometrie[] = []
        for(let toolGeometrieNr = 0;toolGeometrieNr < this.radiusList.length;toolGeometrieNr++){
            if(toolGeometrieNr < this.quadrantList.length){
                toolGeometries.push(new ToolGeometrie(toolGeometrieNr,Number(this.quadrantList[toolGeometrieNr].innerText),Number(this.radiusList[toolGeometrieNr].innerText)))
            }
        }

        return toolGeometries
    }
    
    private createTable(){
        let rowPre = this.table.insertRow();
        let cellPre = rowPre.insertCell();
        cellPre.innerText = "!!! coming soon !!!"
        let row = this.table.insertRow();
        let toolNumber = row.insertCell();
        toolNumber.innerText = String("tool")
        let toolRadius = row.insertCell();
        toolRadius.innerText = String("R")
        let toolQuad = row.insertCell();
        toolQuad.innerText = String("Q")

        for(let tool = 0; tool < this.countOfTools; tool++){
            let row = this.table.insertRow();
            let toolNumber = row.insertCell();
            toolNumber.innerText = String(tool)
            let toolRadius = row.insertCell();
            let toolInputRaduius = document.createElement("span")
            toolInputRaduius.contentEditable = "true"
            toolInputRaduius.innerText = "0.00"
            toolInputRaduius.classList.add("editSpan")
            toolRadius.appendChild(toolInputRaduius)
            let toolQuadrant = row.insertCell();
            let toolInputQuadrant = document.createElement("span")
            toolInputQuadrant.contentEditable = "true"
            toolInputQuadrant.innerText = "0.00"
            toolInputQuadrant.innerText = "0"
            toolInputQuadrant.classList.add("editSpan")
            this.radiusList.push(toolInputRaduius)
            this.quadrantList.push(toolInputQuadrant)
            toolQuadrant.appendChild(toolInputQuadrant)

        }
    }


}

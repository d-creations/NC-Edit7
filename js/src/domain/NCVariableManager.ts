import {ViewObjectCreator} from '../technicalService/ViewObjectCreator.js';
import { UserError } from '../technicalService/error/userError.js';
import { Observable } from '../technicalService/observer.js';
import {IDEAdapter} from './IDEAdapter.js';
import { NCVariable, ToolGeometrie } from './machines/MachineAdapter.js';


export class NCVariableManagerCreator{
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
    createVariableManager(){
        return new NCVariableManager(this.countOfTools,this.printConsole)
    }
}

export class NCVariableManager extends Observable{
    private table: HTMLTableElement
    countOfTools: number
    printConsole: UserError
    variable : HTMLSpanElement[] = []
    

    
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

    public getToolFile() : NCVariable[]{
        let ncVariable : NCVariable[] = []
        for(let variableNr = 0;variableNr < this.variable.length;variableNr++){
            ncVariable.push(new NCVariable(variableNr,Number(this.variable[variableNr].innerText)))

        }
        return ncVariable
    }
    
    private createTable(){
        let rowPre = this.table.insertRow();
        let cellPre = rowPre.insertCell();
        cellPre.innerText = "!!! coming soon !!!"
        let row = this.table.insertRow();
        let toolNumber = row.insertCell();
        toolNumber.innerText = String("Nr")
        let toolRadius = row.insertCell();
        toolRadius.innerText = String("Value")

        for(let tool = 0; tool < this.countOfTools; tool++){
            let row = this.table.insertRow();
            let toolNumber = row.insertCell();
            toolNumber.innerText = String(tool)
            let toolRadius = row.insertCell();
            let toolInputVariable = document.createElement("span")
            toolInputVariable.classList.add("editSpan")
            toolInputVariable.contentEditable = "true"
            toolInputVariable.innerText = "0.00"
            toolRadius.appendChild(toolInputVariable)
            this.variable.push(toolInputVariable)

        }
    }


}

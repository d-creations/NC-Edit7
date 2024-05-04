import { Observable } from '../technicalService/observer.js';
import { NCVariable } from './machines/MachineAdapter.js';
export class NCVariableManagerCreator {
    constructor(countOfTools, printConsole) {
        this.countOfTools = countOfTools;
        this.printConsole = printConsole;
    }
    createVariableManager() {
        return new NCVariableManager(this.countOfTools, this.printConsole);
    }
}
export class NCVariableManager extends Observable {
    constructor(countOfTools, printConsole) {
        super();
        this.variable = [];
        this.table = document.createElement('table');
        this.countOfTools = countOfTools;
        this.printConsole = printConsole;
        this.createTable();
    }
    appendTableTo(parentDiv) {
        let div = document.createElement("div");
        parentDiv.appendChild(div);
        div.classList.add("toolManagerDiv");
        this.table.classList.add("toolManagerTable");
        div.appendChild(this.table);
    }
    getToolFile() {
        let ncVariable = [];
        for (let variableNr = 0; variableNr < this.variable.length; variableNr++) {
            ncVariable.push(new NCVariable(variableNr, Number(this.variable[variableNr].innerText)));
        }
        return ncVariable;
    }
    createTable() {
        let rowPre = this.table.insertRow();
        let cellPre = rowPre.insertCell();
        cellPre.innerText = "!!! coming soon !!!";
        let row = this.table.insertRow();
        let toolNumber = row.insertCell();
        toolNumber.innerText = String("Nr");
        let toolRadius = row.insertCell();
        toolRadius.innerText = String("Value");
        for (let tool = 0; tool < this.countOfTools; tool++) {
            let row = this.table.insertRow();
            let toolNumber = row.insertCell();
            toolNumber.innerText = String(tool);
            let toolRadius = row.insertCell();
            let toolInputVariable = document.createElement("span");
            toolInputVariable.classList.add("editSpan");
            toolInputVariable.contentEditable = "true";
            toolInputVariable.innerText = "0.00";
            toolRadius.appendChild(toolInputVariable);
            this.variable.push(toolInputVariable);
        }
    }
}

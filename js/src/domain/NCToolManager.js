import { Observable } from '../technicalService/observer.js';
import { ToolGeometrie } from './machines/MachineAdapter.js';
export class NCToolManagerCreator {
    constructor(countOfTools, printConsole) {
        this.countOfTools = countOfTools;
        this.printConsole = printConsole;
    }
    createToolManager() {
        return new NCToolManager(this.countOfTools, this.printConsole);
    }
}
export class NCToolManager extends Observable {
    constructor(countOfTools, printConsole) {
        super();
        this.radiusList = [];
        this.quadrantList = [];
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
        let toolGeometries = [];
        for (let toolGeometrieNr = 0; toolGeometrieNr < this.radiusList.length; toolGeometrieNr++) {
            if (toolGeometrieNr < this.quadrantList.length) {
                toolGeometries.push(new ToolGeometrie(toolGeometrieNr, Number(this.quadrantList[toolGeometrieNr].innerText), Number(this.radiusList[toolGeometrieNr].innerText)));
            }
        }
        return toolGeometries;
    }
    createTable() {
        let rowPre = this.table.insertRow();
        let cellPre = rowPre.insertCell();
        cellPre.innerText = "!!! coming soon !!!";
        let row = this.table.insertRow();
        let toolNumber = row.insertCell();
        toolNumber.innerText = String("tool");
        let toolRadius = row.insertCell();
        toolRadius.innerText = String("R");
        let toolQuad = row.insertCell();
        toolQuad.innerText = String("Q");
        for (let tool = 0; tool < this.countOfTools; tool++) {
            let row = this.table.insertRow();
            let toolNumber = row.insertCell();
            toolNumber.innerText = String(tool);
            let toolRadius = row.insertCell();
            let toolInputRaduius = document.createElement("span");
            toolInputRaduius.contentEditable = "true";
            toolInputRaduius.innerText = "0.00";
            toolInputRaduius.classList.add("editSpan");
            toolRadius.appendChild(toolInputRaduius);
            let toolQuadrant = row.insertCell();
            let toolInputQuadrant = document.createElement("span");
            toolInputQuadrant.contentEditable = "true";
            toolInputQuadrant.innerText = "0.00";
            toolInputQuadrant.innerText = "0";
            toolInputQuadrant.classList.add("editSpan");
            this.radiusList.push(toolInputRaduius);
            this.quadrantList.push(toolInputQuadrant);
            toolQuadrant.appendChild(toolInputQuadrant);
        }
    }
}

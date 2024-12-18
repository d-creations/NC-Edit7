import { ViewObjectCreator } from '../technicalService/ViewObjectCreator.js';
export class IDEView {
    constructor(parentDiv, IDEAdapter, canalCount, view3d, printConsole) {
        this._rowWidth = 35.0;
        this.viewList = ["Home", "F_G17", "F_G18", "F_G19"];
        this.IDEAdapter = IDEAdapter;
        this.keyWordTable = document.createElement('table');
        this.keyWordTable.id = "keyWordTable";
        this.keyWordTable.classList.add("keyWordTable");
        this.machineSelectorS = [];
        this.canalCountSelectionButton = document.createElement('select');
        this.parentDiv = parentDiv;
        this.canalCount = canalCount;
        this.tableDiv = document.createElement('div');
        this.tableDiv.id = "editorTable";
        this.tableDiv.classList.add("editorTable");
        this.canalEditHeadDivs = [];
        this.canalGeoHeadDivs = [];
        this.canalExecHeadDivs = [];
        this.canalEditCoreDivs = [];
        this.canalGeoCoreDivs = [];
        this.canalExecCoreDivs = [];
        this.canalVarCoreDivs = [];
        this.canalVarHeadDivs = [];
        this.canalTabs = [];
        IDEView.view3d = view3d;
        this.printConsole = printConsole;
        this.create3DViewMenu(document.getElementById("DView_Menu"));
        this.MulitcheckedBox = ViewObjectCreator.createMultiViewSelector(parentDiv);
        this.MulitcheckedBox.addEventListener(`change`, (e) => {
            this.switchMultiView();
        });
        this.canalCountSelectionButton = ViewObjectCreator.createCountCanalButtons(parentDiv);
        this.canalCountSelectionButton.addEventListener(`change`, (e) => {
            const select = e.target;
            if (select instanceof HTMLSelectElement)
                this.createCanalIfNotExist(Number(select.value));
        });
        this.plotButton = ViewObjectCreator.createPlotButton(parentDiv);
        this.plotButton.addEventListener('click', () => {
            let canalcountList = [];
            for (let i = 0; i < this.canalCount; i++) {
                canalcountList.push(i);
            }
            this.IDEAdapter.plotCNCCode(view3d, printConsole, canalcountList);
        });
        let machineSelector = ViewObjectCreator.createMachineSelector(parentDiv, this.IDEAdapter.controlListMachine());
        machineSelector.addEventListener(`change`, (e) => {
            const select = e.target;
            if (select instanceof HTMLSelectElement)
                this.selectMachine(select.value);
        });
        this.clearButton = ViewObjectCreator.createClearButton(parentDiv);
        this.clearButton.addEventListener('click', () => this.IDEAdapter.allCanalClear());
        this.exampleButton = ViewObjectCreator.createExampleButton(parentDiv);
        this.exampleButton.addEventListener('click', () => this.IDEAdapter.loadExampleProgram());
        this.TimeViewSelector = ViewObjectCreator.createTimeViewSelector(parentDiv);
        this.TimeViewSelector.addEventListener(`change`, (e) => {
            const select = e.target;
            if (select instanceof HTMLInputElement) {
                this.IDEAdapter.setTimeLineVisible(select.checked);
            }
        });
        this.timeLable = ViewObjectCreator.createLabel(parentDiv, " ");
        ViewObjectCreator.createLabel(parentDiv, " sec");
        this.parentDiv.appendChild(this.tableDiv);
        this.createCanalIfNotExist(canalCount);
        let tempViewSelector = ViewObjectCreator.createViewSelector(parentDiv, this.viewList);
        if (tempViewSelector instanceof (HTMLSelectElement)) {
            this.viewSelector = tempViewSelector;
            this.viewSelector.addEventListener(`change`, (e) => {
                const select = e.target;
                if (select instanceof HTMLSelectElement)
                    IDEView.view3d.viewChange(select.value);
            });
        }
        else {
            throw new Error('Page Error define tempViewSelector');
        }
        ;
        this.IDEAdapter.sync_waitCodeOff();
        this.updateWaitLineTable();
        this.IDEAdapter.addViewObserver(this);
    }
    changeCanalCount(canalCount) {
        this.createCanalIfNotExist(canalCount);
    }
    switchMultiView() {
        const select = this.MulitcheckedBox;
        if (select instanceof HTMLInputElement) {
            if (select.checked) {
                if (this.IDEAdapter.sync_waitCode())
                    this.sync_scroll();
                else
                    select.checked = false;
            }
            else {
                this.sync_waitCodeOff();
                this.sync_scrollOff();
            }
        }
    }
    OberverUpdate() {
        this.updateWaitLineTable();
        this.timeLable.textContent = this.IDEAdapter.getCalcTime();
    }
    createCanalIfNotExist(canalCount) {
        this.canalCount = canalCount;
        this.canalCountSelectionButton.selectedIndex = canalCount - 1;
        this.removeAllCanals();
        if (canalCount < 1)
            throw new Error("Canal count Wrong");
        this.CreateEditorTableView(canalCount);
        this.TimeViewSelector.checked = false;
        this.MulitcheckedBox.checked = false;
        this.sync_waitCodeOff();
        this.sync_scrollOff();
        this.IDEAdapter.createIDE(this.canalEditCoreDivs, this.canalExecCoreDivs, this.canalGeoCoreDivs, this.canalVarCoreDivs);
        this.updateWaitLineTable();
        this.switchToTab(0);
    }
    CreateEditorTableView(canalCount) {
        this.removeAllCanals();
        let keyDivHead = document.createElement("div");
        keyDivHead.classList.add("keyDivHead");
        ViewObjectCreator.createLabel(keyDivHead, "key");
        this.tableDiv.appendChild(keyDivHead);
        this.tableDiv.appendChild(keyDivHead);
        let keyWordsDiv = document.createElement('div');
        keyWordsDiv.classList.add("keyWordsDiv");
        keyWordsDiv.appendChild(this.keyWordTable);
        this.tableDiv.appendChild(keyWordsDiv);
        for (let canal = 0; canal < canalCount; canal++) {
            let canalTabDiv = document.createElement("div");
            canalTabDiv.classList.add("canalTabDiv");
            canalTabDiv.style.gridColumn = String(canal + 2);
            this.tableDiv.appendChild(canalTabDiv);
            let tab1 = ViewObjectCreator.createTabButton(canalTabDiv, "Edit");
            let tab2 = ViewObjectCreator.createTabButton(canalTabDiv, "Exec");
            let tab3 = ViewObjectCreator.createTabButton(canalTabDiv, "Geo");
            let tab4 = ViewObjectCreator.createTabButton(canalTabDiv, "Var");
            this.canalTabs.push(tab1);
            this.canalTabs.push(tab2);
            this.canalTabs.push(tab3);
            this.canalTabs.push(tab4);
            this.canalTabs.forEach((tab) => tab.classList.add("tabInactiv"));
            tab1.addEventListener('click', () => this.switchToTab(0));
            tab2.addEventListener('click', () => this.switchToTab(1));
            tab3.addEventListener('click', () => this.switchToTab(2));
            tab4.addEventListener('click', () => this.switchToTab(3));
            let canalExecHeadDiv = document.createElement("div");
            canalExecHeadDiv.classList.add("canalHeadDiv");
            canalExecHeadDiv.style.gridColumn = String(canal + 2);
            this.canalExecHeadDivs.push(canalExecHeadDiv);
            this.tableDiv.appendChild(canalExecHeadDiv);
            canalExecHeadDiv.style.display = "none";
            ViewObjectCreator.createLabel(canalExecHeadDiv, "Exectuted Plot H" + (Number(canal) + 1) + "");
            let canalVarHeadDiv = document.createElement("div");
            canalVarHeadDiv.classList.add("canalHeadDiv");
            canalVarHeadDiv.style.gridColumn = String(canal + 2);
            this.canalVarHeadDivs.push(canalVarHeadDiv);
            this.tableDiv.appendChild(canalVarHeadDiv);
            canalVarHeadDiv.style.display = "none";
            ViewObjectCreator.createLabel(canalVarHeadDiv, "Variable " + (Number(canal) + 1) + "");
            let canalGeoHeadDiv = document.createElement("div");
            canalGeoHeadDiv.classList.add("canalHeadDiv");
            canalGeoHeadDiv.style.gridColumn = String(canal + 2);
            this.canalGeoHeadDivs.push(canalGeoHeadDiv);
            this.tableDiv.appendChild(canalGeoHeadDiv);
            canalGeoHeadDiv.style.display = "none";
            ViewObjectCreator.createLabel(canalGeoHeadDiv, "Geo" + (Number(canal) + 1) + "");
            let canalHeadDiv = document.createElement("div");
            canalHeadDiv.classList.add("canalHeadDiv");
            canalHeadDiv.style.gridColumn = String(canal + 2);
            this.canalEditHeadDivs.push(canalHeadDiv);
            this.tableDiv.appendChild(canalHeadDiv);
            ViewObjectCreator.createLabel(canalHeadDiv, "H" + (Number(canal) + 1) + "");
            this.machineSelectorS.push(ViewObjectCreator.createMachineSelectorS(canalHeadDiv, this.IDEAdapter.controllListCanal(canal)));
            this.machineSelectorS[canal].addEventListener(`change`, (e) => {
                const select = e.target;
                if (select instanceof HTMLSelectElement)
                    this.IDEAdapter.setSelectedMachineS(canal, select.value);
            });
            this.IDEAdapter.setSelectedMachineS(canal, this.machineSelectorS[canal].value);
            let playButton = ViewObjectCreator.createPlayButton(canalHeadDiv);
            playButton.addEventListener('click', () => {
                this.IDEAdapter.plotCNCCode(IDEView.view3d, this.printConsole, [Number(canal)]);
            });
            let undoButton = ViewObjectCreator.createInputButton(canalHeadDiv, "./image/undo.png");
            undoButton.addEventListener('click', () => {
                this.IDEAdapter.undoCanal(Number(canal));
            });
            let redoButton = ViewObjectCreator.createInputButton(canalHeadDiv, "./image/redo.png");
            redoButton.addEventListener('click', () => {
                this.IDEAdapter.redoCanal(Number(canal));
            });
            let addSpaceButton = ViewObjectCreator.createInputButton(canalHeadDiv, "./image/addSpace.png");
            addSpaceButton.addEventListener('click', () => {
                this.IDEAdapter.addSpaceCanal(Number(canal));
            });
            let rmSpaceButton = ViewObjectCreator.createInputButton(canalHeadDiv, "./image/rmSpace.png");
            rmSpaceButton.addEventListener('click', () => {
                this.IDEAdapter.removeSpaceCanal(Number(canal));
            });
            let searchButton = ViewObjectCreator.createInputButton(canalHeadDiv, "./image/search.png");
            searchButton.addEventListener('click', () => {
                this.IDEAdapter.openSearchBox(Number(canal));
            });
            let canaldiv = document.createElement("div");
            canaldiv.style.gridColumn = String(canal + 2);
            canaldiv.classList.add("tabCore");
            this.tableDiv.appendChild(canaldiv);
            canaldiv.style.overflow = "hidden";
            this.canalEditCoreDivs.push(canaldiv);
            let canalVardiv = document.createElement("div");
            canalVardiv.style.gridColumn = String(canal + 2);
            canalVardiv.classList.add("tabCore");
            this.tableDiv.appendChild(canalVardiv);
            this.canalVarCoreDivs.push(canalVardiv);
            let canalGeodiv = document.createElement("div");
            canalGeodiv.style.gridColumn = String(canal + 2);
            canalGeodiv.classList.add("tabCore");
            this.tableDiv.appendChild(canalGeodiv);
            this.canalGeoCoreDivs.push(canalGeodiv);
            let canalExecdiv = document.createElement("div");
            canalExecdiv.style.gridColumn = String(canal + 2);
            canalExecdiv.classList.add("tabCore");
            this.tableDiv.appendChild(canalExecdiv);
            this.canalExecCoreDivs.push(canalExecdiv);
        }
        ;
        this.IDEAdapter.setTimeLineVisible(true);
        let keyTeblewidth = String(this._rowWidth * canalCount) + "pt";
        switch (canalCount) {
            case 1:
                this.tableDiv.style.gridTemplateColumns = keyTeblewidth + " 1fr";
                break;
            case 2:
                this.tableDiv.style.gridTemplateColumns = keyTeblewidth + " 1fr 1fr";
                break;
            case 3:
                this.tableDiv.style.gridTemplateColumns = keyTeblewidth + " 1fr 1fr 1fr";
                break;
        }
        keyWordsDiv.style.maxWidth = String(this._rowWidth * canalCount) + "pt";
        keyWordsDiv.style.width = String(this._rowWidth * canalCount) + "pt";
        this.IDEAdapter.setTimeLineVisible(true);
        return;
    }
    switchToTab(tab) {
        this.canalTabs.forEach((tab) => tab.classList.replace("tabActiv", "tabInactiv"));
        for (let canalI = 0; canalI < this.canalCount; canalI++) {
            switch (tab) {
                case 0:
                    this.canalEditHeadDivs.forEach((div) => div.style.display = "block");
                    this.canalExecHeadDivs.forEach((div) => div.style.display = "none");
                    this.canalGeoHeadDivs.forEach((div) => div.style.display = "none");
                    this.canalEditCoreDivs.forEach((div) => div.style.display = "block");
                    this.canalExecCoreDivs.forEach((div) => div.style.display = "none");
                    this.canalGeoCoreDivs.forEach((div) => div.style.display = "none");
                    this.canalVarHeadDivs.forEach((div) => div.style.display = "none");
                    this.canalVarCoreDivs.forEach((div) => div.style.display = "none");
                    break;
                case 1:
                    this.canalEditHeadDivs.forEach((div) => div.style.display = "none");
                    this.canalExecHeadDivs.forEach((div) => div.style.display = "block");
                    this.canalGeoHeadDivs.forEach((div) => div.style.display = "none");
                    this.canalEditCoreDivs.forEach((div) => div.style.display = "none");
                    this.canalExecCoreDivs.forEach((div) => div.style.display = "block");
                    this.canalGeoCoreDivs.forEach((div) => div.style.display = "none");
                    this.canalVarHeadDivs.forEach((div) => div.style.display = "none");
                    this.canalVarCoreDivs.forEach((div) => div.style.display = "none");
                    break;
                case 2:
                    this.canalEditHeadDivs.forEach((div) => div.style.display = "none");
                    this.canalExecHeadDivs.forEach((div) => div.style.display = "none");
                    this.canalGeoHeadDivs.forEach((div) => div.style.display = "block");
                    this.canalEditCoreDivs.forEach((div) => div.style.display = "none");
                    this.canalExecCoreDivs.forEach((div) => div.style.display = "none");
                    this.canalGeoCoreDivs.forEach((div) => div.style.display = "block");
                    this.canalVarHeadDivs.forEach((div) => div.style.display = "none");
                    this.canalVarCoreDivs.forEach((div) => div.style.display = "none");
                    break;
                case 3:
                    this.canalEditHeadDivs.forEach((div) => div.style.display = "none");
                    this.canalExecHeadDivs.forEach((div) => div.style.display = "none");
                    this.canalGeoHeadDivs.forEach((div) => div.style.display = "none");
                    this.canalEditCoreDivs.forEach((div) => div.style.display = "none");
                    this.canalExecCoreDivs.forEach((div) => div.style.display = "none");
                    this.canalGeoCoreDivs.forEach((div) => div.style.display = "none");
                    this.canalVarHeadDivs.forEach((div) => div.style.display = "block");
                    this.canalVarCoreDivs.forEach((div) => div.style.display = "block");
                    break;
            }
            this.canalTabs[tab + canalI * 4].classList.replace("tabInactiv", "tabActiv");
        }
    }
    updateWaitLineTable() {
        while (this.keyWordTable.lastElementChild) {
            this.keyWordTable.removeChild(this.keyWordTable.lastElementChild);
        }
        let keyOne = this.IDEAdapter.getCanalKeyElementList(0);
        let keyTwo = [];
        let keyTree = [];
        if (this.canalCount > 1)
            keyTwo = this.IDEAdapter.getCanalKeyElementList(1);
        if (this.canalCount > 2)
            keyTree = this.IDEAdapter.getCanalKeyElementList(2);
        let interator = 0;
        while (keyOne.length > interator || keyTwo.length > interator || keyTree.length > interator) {
            let waitTableR = this.keyWordTable.insertRow();
            let waitTableC = waitTableR.insertCell();
            if (keyOne.length > interator) {
                waitTableC.appendChild(keyOne[interator]);
            }
            else
                waitTableC.appendChild(document.createElement("label"));
            if (this.canalCount > 1) {
                let waitTableC2 = waitTableR.insertCell();
                if (keyTwo.length > interator) {
                    waitTableC2.appendChild(keyTwo[interator]);
                }
                waitTableC2.appendChild(document.createElement("label"));
            }
            if (this.canalCount > 2) {
                let waitTableC3 = waitTableR.insertCell();
                if (keyTree.length > interator) {
                    waitTableC3.appendChild(keyTree[interator]);
                }
                waitTableC3.appendChild(document.createElement("label"));
            }
            interator += 1;
        }
    }
    removeAllCanals() {
        while (this.tableDiv.lastElementChild) {
            this.tableDiv.removeChild(this.tableDiv.lastElementChild);
        }
        while (this.canalEditCoreDivs.length > 0) {
            this.canalEditCoreDivs.pop();
        }
        while (this.canalGeoCoreDivs.length > 0) {
            this.canalGeoCoreDivs.pop();
        }
        while (this.canalExecCoreDivs.length > 0) {
            this.canalExecCoreDivs.pop();
        }
        while (this.canalVarCoreDivs.length > 0) {
            this.canalVarCoreDivs.pop();
        }
        while (this.canalTabs.length > 0) {
            this.canalTabs.pop();
        }
        this.machineSelectorS = [];
        this.canalEditHeadDivs = [];
        this.canalGeoHeadDivs = [];
        this.canalExecHeadDivs = [];
        this.canalTabs = [];
        this.keyWordTable.childNodes.forEach((node) => this.keyWordTable.removeChild(node));
    }
    selectMachine(machine) {
        let index = 0;
        if (machine == "STAR_SB_12RG")
            index = 0;
        else if (machine == "FANUC_TURN")
            index = 1;
        else if (machine == "SR_20JII")
            index = 2;
        for (let canal = 0; canal < this.canalCount; canal++) {
            this.machineSelectorS[canal].selectedIndex = index;
            this.IDEAdapter.setSelectedMachineS(canal, this.machineSelectorS[canal].value);
        }
    }
    sync_scroll() {
        this.IDEAdapter.sync_scroll();
    }
    sync_scrollOff() {
        this.IDEAdapter.sync_scrollOff();
    }
    sync_waitCodeOff() {
        this.IDEAdapter.sync_waitCodeOff();
    }
    sync_waitCode() {
        this.IDEAdapter.sync_waitCode();
    }
    create3DViewMenu(parentDiv) {
        let input_button = document.createElement('input');
        input_button.type = "image";
        input_button.src = "./image/trash.png";
        input_button.alt = "trash";
        input_button.classList.add("MenuButton");
        input_button.addEventListener('click', () => {
            IDEView.view3d.clearPlot();
        });
        parentDiv.appendChild(input_button);
        let dot_img = document.createElement('img');
        dot_img.classList.add("menuImage");
        dot_img.alt = "dot";
        dot_img.src = "./image/dot.png";
        parentDiv.appendChild(dot_img);
        let pointSelect = document.createElement('select');
        pointSelect.id = "point";
        for (let dia of ["0.4", "0.05", "0.1", "0.2"]) {
            let option = document.createElement('option');
            option.value = dia;
            option.text = dia;
            pointSelect.appendChild(option);
        }
        pointSelect.addEventListener('change', (e) => {
            const select = e.target;
            if (select instanceof HTMLSelectElement)
                IDEView.view3d.setPointRadius(select.value);
        });
        parentDiv.appendChild(pointSelect);
        let viewSelction = document.createElement('select');
        parentDiv.appendChild(viewSelction);
        viewSelction.id = "selectView";
        viewSelction.name = "selectView";
    }
}

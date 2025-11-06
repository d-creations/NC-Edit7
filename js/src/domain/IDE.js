import { CanalAdapter } from './canalAdapter.js';
import { ExampleCreator } from '../technicalService/ExampleCreator.js';
import { Observable } from '../technicalService/observer.js';
export class IDE extends Observable {
    getCanalsCount() {
        return this.canals.length;
    }
    constructor(parentDiv, canalCount, view3d, printConsole, canalCreationFunciton, toolManagerCreator, variableManagerCreator, machineManager) {
        super();
        this.runCalctime = "";
        this.toolManagers = [];
        this.variableManagers = [];
        this.exampleCreator = new ExampleCreator();
        this.parentDiv = parentDiv;
        IDE.view3d = view3d;
        this.printConsole = printConsole;
        this.canalCreationFunciton = canalCreationFunciton;
        this.toolManagerCreator = toolManagerCreator;
        this.variableManagerCreator = variableManagerCreator;
        this.machineManager = machineManager;
    }
    createIDE(canalDiv, canalExecDiv, toolManagerDiv, varManagerDiv) {
        if (canalDiv.length < 1)
            throw new Error("Canal count Wrong");
        while (0 < IDE.canals.length)
            IDE.canals.pop();
        while (0 < IDE.canalExecs.length)
            IDE.canalExecs.pop();
        for (let i = IDE.canals.length; i < canalDiv.length; i++) {
            IDE.canals.push(new CanalAdapter(i + 1, IDE.view3d, canalDiv[i], this.canalCreationFunciton, false, false));
            IDE.canalExecs.push(new CanalAdapter(i + 10, IDE.view3d, canalExecDiv[i], this.canalCreationFunciton, true, true));
            let toolManager = this.toolManagerCreator.createToolManager();
            toolManager.appendTableTo(toolManagerDiv[i]);
            this.toolManagers.push(toolManager);
            let variableManager = this.variableManagerCreator.createVariableManager();
            variableManager.appendTableTo(varManagerDiv[i]);
            this.variableManagers.push(variableManager);
        }
        this.canals.forEach(canal => {
            canal.restoreText();
            canal.addObserver(this);
        });
    }
    getTextFromCanal(canalnr) {
        return this.canals[canalnr].text;
    }
    getCalcTime() {
        return String(IDE.CompleteTime);
    }
    getCanalKeyList(canal) {
        if (canal < this.canals.length)
            return this.canals[canal].keyElementList;
        else
            return [];
    }
    setTimeLineVisible(checked) {
        if (checked)
            this.canals.forEach(canal => { canal.timeLineVisible(true); });
        else
            this.canals.forEach(canal => { canal.timeLineVisible(false); });
    }
    loadExampleProgram() {
        {
            let programms = this.exampleCreator.getExample(this.canals.length, this);
        }
    }
    allCanalClear() {
        this.canals.forEach(canal => { canal.clearText(); });
    }
    controlListCanal(canal) {
        return this.machineManager.getControlListCanal(canal);
    }
    undoCanal(canal) {
        IDE.canals[canal].undo();
    }
    redoCanal(canal) {
        IDE.canals[canal].redo();
    }
    addSpaceCanal(canal) {
        IDE.canals[canal].addSpace();
    }
    removeSpaceCanal(canal) {
        IDE.canals[canal].removeSpace();
    }
    openSearchBox(canal) {
        IDE.canals[canal].openSearchBox();
    }
    controlListMachine() {
        return this.machineManager.getControlListMachine();
    }
    setSelectedMachine(canal, machineName) {
        this.machineManager.setSelectedMachine(canal, machineName);
    }
    setTextToCanal(canalIndex, text) {
        if (canalIndex < this.canals.length)
            this.canals[canalIndex].text = text;
    }
    OberverUpdate() {
        this.printConsole.printMessage("");
        this.updated();
    }
    plotNextLine() {
    }
    plotPreveusLine() {
    }
    static clearPlot() {
        IDE.canals.forEach(canal => canal.resetPlotPosition());
    }
    clearPlot() {
        IDE.canals.forEach(canal => canal.resetPlotPosition());
    }
    static setRadius(radius) {
        IDE.view3d.setPointRadius(Number(radius));
    }
    plotCNCCode(view3d, printConsole, canalNumbers) {
        let programs = [];
        for (let canalNumber of canalNumbers) {
            if (canalNumber <= this.canals.length)
                programs.push(this.canals[canalNumber].text);
        }
        let toolGeometries = [];
        this.toolManagers.forEach((toolManager) => toolGeometries.push(toolManager.getToolFile()));
        let ncVariables = [];
        this.variableManagers.forEach((variableManager) => ncVariables.push(variableManager.getToolFile()));
        this.machineManager.plotCNCCode(view3d, canalNumbers, programs, toolGeometries, ncVariables).then((response) => {
            if (response != null) {
                let o = response;
                let message_t = o.message;
                if (message_t.length > 4)
                    message_t = message_t.substring(0, message_t.length - 4);
                printConsole.printMessage(message_t);
                view3d.clearPlot();
                let times = [];
                let programIndex = 0;
                for (let resp_canal of o.canal) {
                    let line_index = 0;
                    let time = 0.0;
                    let timeLineList = [];
                    // validate canal index and guard against undefined canals (prevents getLength() on undefined)
                    // accept formats like "C0" or "0" by extracting the first integer substring
                    const rawCanalNr = String(resp_canal.canalNr);
                    let canalNr = NaN;
                    const m = rawCanalNr.match(/-?\d+/);
                    if (m) {
                        canalNr = parseInt(m[0], 10);
                    }
                    else {
                        // fallback to direct numeric coercion
                        canalNr = Number(rawCanalNr);
                    }
                    if (!Number.isInteger(canalNr) || canalNr < 0 || canalNr >= IDE.canals.length) {
                        console.error('plotCNCCode: invalid canal index', resp_canal.canalNr, 'parsed as', canalNr, 'canals length', IDE.canals.length, resp_canal);
                        // skip this canal response if the target canal doesn't exist
                        continue;
                    }
                    const canal = IDE.canals[canalNr];
                    const canalExec = IDE.canalExecs[canalNr];
                    let plotlineEdit = Array.apply(null, Array(canal.getLength())).map(function (x, i) { return []; });
                    let plotlinesExec = [];
                    let timeLineListEdit = Array.apply(null, Array(canal.getLength())).map(function (x, i) { return ["-:--"]; });
                    if (resp_canal.plot.length > programIndex && resp_canal.plot.length > 0) {
                        for (let i = 0; i < resp_canal.plot.length; i++) {
                            line_index = i;
                            plotlineEdit[resp_canal.programExec[i]].push(resp_canal.plot[line_index]);
                            plotlinesExec.push([resp_canal.plot[i]]);
                            view3d.plot(resp_canal.plot[line_index]);
                            let t = String(resp_canal.plot[line_index].t);
                            let time_t = parseFloat(t);
                            time += time_t;
                            t = String(time_t.toFixed(2));
                            if (t.length > 4)
                                t = t.substring(0, 4);
                            timeLineList.push(t);
                            timeLineListEdit[resp_canal.programExec[i]] = t;
                        }
                        canal.timeLine = timeLineListEdit;
                        if (canalExec)
                            canalExec.timeLine = timeLineList;
                    }
                    times.push(time);
                    programIndex += 1;
                    canal.resetPlotPosition();
                    canal.plotLines = plotlineEdit;
                    let execProgram = resp_canal.programExec;
                    let execText = "";
                    let program = canal.text.split("\n");
                    for (let line of execProgram) {
                        execText += program[line] + "\n";
                    }
                    if (canalExec) {
                        canalExec.plotLines = plotlinesExec;
                        canalExec.text = execText;
                    }
                }
                // protect against empty times array (avoid calling toFixed on undefined)
                if (times.length > 0 && typeof times[0] === 'number') {
                    IDE.CompleteTime = times[0].toFixed(2);
                }
                else if (times.length > 0) {
                    // try to coerce to number, fall back to 0.00
                    const t0 = parseFloat(times[0]);
                    IDE.CompleteTime = isNaN(t0) ? "0.00" : t0.toFixed(2);
                }
                else {
                    console.warn('plotCNCCode: no times were produced, setting CompleteTime to 0.00');
                    IDE.CompleteTime = "0.00";
                }
                this.updated();
            }
        });
    }
    sync_scroll() {
        IDE.canals.forEach((canal1) => {
            IDE.canals.forEach((canal2) => {
                if (canal1 != canal2) {
                    canal2.bindScrollTop(canal1);
                    canal2.bindScrollLeft(canal2);
                }
            });
        });
    }
    updateToolNumber() {
    }
    sync_scrollOff() {
        IDE.canals.forEach((canal) => {
            canal.unbindAllSyncScrollLeft();
            canal.unbindAllSyncScrollTop();
        });
    }
    sync_waitCodeOff() {
        let spaceSybole = "\u2002";
        for (let canal in IDE.canals) {
            while (IDE.canals[canal].text.indexOf("\n" + spaceSybole + "\n") > 1) {
                IDE.canals[canal].text = IDE.canals[canal].text.replaceAll("\n" + spaceSybole + "\n", "\n");
            }
        }
    }
    sync_waitCode() {
        let spaceSybole = "\u2002";
        this.sync_waitCodeOff();
        let textAreas = [];
        let NtextAreas = [];
        for (let canal in IDE.canals) {
            let t = IDE.canals[canal].text;
            let text = t.split("\n");
            textAreas.push(text);
        }
        NtextAreas = this.machineManager.sync_waitCode(textAreas, spaceSybole);
        if (NtextAreas[0].length >= 9999) {
            let message = "";
            for (let text in NtextAreas) {
                let num = Number(text) + 1;
                message += "HEAD" + num + " " + NtextAreas[text][NtextAreas[text].length - 1];
            }
            this.printConsole.printMessage("There is an error with the wait code\n " + message);
            return false;
        }
        else {
            for (let canal in IDE.canals) {
                let text = "";
                for (let line in NtextAreas[canal]) {
                    text = text + NtextAreas[canal][line] + "\n";
                }
                IDE.canals[canal].text = text;
            }
        }
        return true;
    }
    get canals() {
        return IDE.canals;
    }
}
IDE.canals = [];
IDE.canalExecs = [];

export class IDEAdapter {
    constructor(IDEController) {
        this.IDEController = IDEController;
    }
    addViewObserver(observer) {
        this.IDEController.addObserver(observer);
    }
    OberverUpdate() {
        this.IDEController.OberverUpdate();
    }
    getCanalsCount() {
        return this.IDEController.getCanalsCount();
    }
    getTextFromCanal(canal) {
        return this.IDEController.getTextFromCanal(canal);
    }
    getCalcTime() {
        return this.IDEController.getCalcTime();
    }
    clearPlot() {
        this.IDEController.clearPlot();
    }
    removeSpaceCanal(canal) {
        this.IDEController.removeSpaceCanal(canal);
    }
    openSearchBox(canal) {
        this.IDEController.openSearchBox(canal);
    }
    addSpaceCanal(canal) {
        this.IDEController.addSpaceCanal(canal);
    }
    redoCanal(canal) {
        this.IDEController.redoCanal(canal);
    }
    undoCanal(canal) {
        this.IDEController.undoCanal(canal);
    }
    controllListCanal(canal) {
        return this.IDEController.controlListCanal(canal);
    }
    setSelectedMachineS(canal, machineName) {
        this.IDEController.setSelectedMachine(canal, machineName);
    }
    setTextToCanal(canalIndex, text) {
        this.IDEController.setTextToCanal(canalIndex, text);
    }
    controlListMachine() {
        return this.IDEController.controlListMachine();
    }
    createIDE(canalDiv, canalExecDiv, toolManagerDiv, varManagerDiv) {
        this.IDEController.createIDE(canalDiv, canalExecDiv, toolManagerDiv, varManagerDiv);
    }
    getCanalKeyElementList(canal) {
        return this.IDEController.getCanalKeyList(canal);
    }
    sync_waitCode() {
        return this.IDEController.sync_waitCode();
    }
    sync_scroll() {
        this.IDEController.sync_scroll();
    }
    setTimeLineVisible(checked) {
        this.IDEController.setTimeLineVisible(checked);
    }
    loadExampleProgram() {
        this.IDEController.loadExampleProgram();
    }
    allCanalClear() {
        this.IDEController.allCanalClear();
    }
    sync_scrollOff() {
        this.IDEController.sync_scrollOff();
    }
    sync_waitCodeOff() {
        this.IDEController.sync_waitCodeOff();
    }
    plotCNCCode(view3d, printConsole, canalcountList) {
        this.IDEController.plotCNCCode(view3d, printConsole, canalcountList);
    }
}

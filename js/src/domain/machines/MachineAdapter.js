export class MachineDataRequest {
    constructor(canalNr, machineName, program, toolGeometries, ncVariable) {
        this.machineName = machineName;
        this.program = program;
        this.toolGeometries = toolGeometries;
        this.ncVariable = ncVariable;
        this.canalNr = canalNr;
    }
}
export class ToolGeometrie {
    constructor(toolNumber, q, r) {
        this.toolNumber = toolNumber;
        this.q = q;
        this.r = r;
    }
}
export class NCVariable {
    constructor(variableNumber, value) {
        this.variableNumber = variableNumber;
        this.value = value;
    }
}
export class MachineAdapter {
    sync_waitCode(textAreas, spaceSybole) {
        return this.machine.sync_waitCode(textAreas, spaceSybole);
    }
    async plotCNCCode(view3d, canalNumbers, program, toolGeometries, ncVariable) {
        return await this.machine.plotCNCCode(view3d, canalNumbers, program, toolGeometries, ncVariable);
    }
    setSelectedMachine(canal, machineName) {
        this.machine.setSelectedMachine(canal, machineName);
    }
    getControlListMachine() {
        return this.machine.getControlListMachine();
    }
    getControlListCanal(canal) {
        return this.machine.getControlListCanal(canal);
    }
    constructor(machine) {
        this.machine = machine;
    }
}

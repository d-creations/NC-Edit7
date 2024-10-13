export class MachineManager {
    sync_waitCode(textAreas, spaceSybole) {
        return this.machine.sync_waitCode(textAreas, spaceSybole);
    }
    async plotCNCCode(view3d, canalNumbers, program, toolGeometries, ncVariable) {
        if (this.machine != null)
            return await this.machine.plotCNCCode(view3d, canalNumbers, program, toolGeometries, ncVariable);
        else
            return null;
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
    constructor() {
        this.machine = null;
    }
    setMaschine(machine) {
        this.machine = machine;
    }
}

export class MachineManagerAdapter {
    sync_waitCode(textAreas, spaceSybole) {
        return this.machineProxy.sync_waitCode(textAreas, spaceSybole);
    }
    async plotCNCCode(view3d, canalNumbers, program, toolGeometries, ncVariable) {
        return await this.machineProxy.plotCNCCode(view3d, canalNumbers, program, toolGeometries, ncVariable);
    }
    setSelectedMachine(canal, machineName) {
        this.machineProxy.setSelectedMachine(canal, machineName);
    }
    getControlListMachine() {
        return this.machineProxy.getControlListMachine();
    }
    getControlListCanal(canal) {
        return this.machineProxy.getControlListCanal(canal);
    }
    constructor(machineProxy) {
        this.machineProxy = machineProxy;
    }
    setMaschine(machine) {
        this.machineProxy.setMaschine(machine);
    }
}

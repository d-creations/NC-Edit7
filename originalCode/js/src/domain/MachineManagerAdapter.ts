/**
 * autor : roth 
 * date : 2024
 * 
 * Editor class 
 * 
*               
 */
import { MachineManager } from './MachineManager.js';
import { MachineAdapter, NCVariable, ToolGeometrie } from './machines/MachineAdapter.js';


export class MachineManagerAdapter{
    sync_waitCode(textAreas: any[], spaceSybole: string): any[] {
        return this.machineProxy.sync_waitCode(textAreas , spaceSybole)
    }
    async plotCNCCode(view3d: any, canalNumbers: number[],program : string[],toolGeometries: ToolGeometrie[][], ncVariable : NCVariable[][]) {
        return await this.machineProxy.plotCNCCode(view3d,canalNumbers,program,toolGeometries,ncVariable )
    }
    setSelectedMachine(canal: number, machineName: string) {
        this.machineProxy.setSelectedMachine(canal,machineName)
    }
    public getControlListMachine(): string[] {
        return this.machineProxy.getControlListMachine()
    }

    public getControlListCanal(canal: number): string[] {
        return this.machineProxy.getControlListCanal(canal)
    }
    machineProxy : MachineManager

    constructor(machineProxy : MachineManager) {
        this.machineProxy = machineProxy
    }

    setMaschine(machine : MachineAdapter){
        this.machineProxy.setMaschine(machine)
    }
}

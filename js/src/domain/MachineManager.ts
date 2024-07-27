import { MachineAdapter, NCVariable, ToolGeometrie } from "./machines/MachineAdapter.js"


export class MachineManager{
    sync_waitCode(textAreas: any[], spaceSybole: string) : any[]{
        return this.machine.sync_waitCode(textAreas,spaceSybole)
    }
    async plotCNCCode(view3d: any, canalNumbers: number[],program : string[],toolGeometries: ToolGeometrie[][], ncVariable : NCVariable[][]) {
        if(this.machine != null)return await this.machine.plotCNCCode(view3d,canalNumbers,program,toolGeometries,ncVariable)
        else return null
    }

    public setSelectedMachine(canal: number, machineName: string) {
        this.machine.setSelectedMachine(canal,machineName)
    }
    public getControlListMachine(): string[] {
        return this.machine.getControlListMachine()
    }
    public getControlListCanal(canal: number): string[] {
        return this.machine.getControlListCanal(canal)
    }


    private machine : MachineAdapter
    constructor(){
        this.machine = null
    }

    setMaschine(machine : MachineAdapter){
        this.machine = machine
    }
}

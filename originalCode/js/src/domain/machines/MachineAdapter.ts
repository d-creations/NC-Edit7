import { Machine_Star } from './Machine_Star.js';

export interface MachineResponse {
    message: string;
    canal:  {
        plot : {
            t : string
            x : string
            y : string
            z : string
            line : string
        }[]
        canalNr : string
        programExec : string[]
        variables : string[]
        ncState : string
        }[]
}

export interface MachinePlotDataRequest {
    machines:MachineDataRequest[];
    }
export class MachineDataRequest{
    machineName : string
    program : string
    toolGeometries : ToolGeometrie[]
    ncVariable : NCVariable[]
    canalNr : Number
    constructor(canalNr : Number,machineName: string,program : string, toolGeometries : ToolGeometrie[],ncVariable : NCVariable[]){
        this.machineName = machineName;
        this.program = program
        this.toolGeometries = toolGeometries
        this.ncVariable = ncVariable
        this.canalNr = canalNr
    }
}

export class ToolGeometrie{
    toolNumber : number
    q : number
    r : number
    constructor(toolNumber : number,q : number,r : number){
        this.toolNumber = toolNumber
        this.q = q
        this.r = r
    }
}
export class NCVariable{
    variableNumber : number
    value : number
    constructor(variableNumber : number,value : number){
        this.variableNumber = variableNumber
        this.value = value
    }
}



export class MachineAdapter{
    sync_waitCode(textAreas: any[], spaceSybole: string): any[] {
        return this.machine.sync_waitCode(textAreas,spaceSybole)
    }
    async plotCNCCode(view3d: any, canalNumbers: number[],program : string[],toolGeometries: ToolGeometrie[][], ncVariable : NCVariable[][]) {
        return await this.machine.plotCNCCode(view3d,canalNumbers,program,toolGeometries,ncVariable )
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

    private machine : Machine_Star

    constructor(machine : Machine_Star){
        this.machine = machine;
    }
}

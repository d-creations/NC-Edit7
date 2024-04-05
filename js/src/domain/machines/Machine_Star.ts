    
import { UserError } from '../../technicalService/error/userError.js';
import {MachineDataRequest, MachineResponse, NCVariable, ToolGeometrie} from './MachineAdapter.js';

export class Machine_Star{
    sync_waitCode(textAreas: any[], spaceSybole: string): any[] {
        
        let NtextAreas = []
        let interator = 0
        function getKeyWords(line: string) {
            line = line.replaceAll(/\(.*\)/g, "")
            line = line.replaceAll(" ", "")
            let waitMCode = 0
            let waitPCode = 0
            let tCode = 0

            if (line.match(".*M.*P.*")) {
                line = line.replaceAll(/[A-LN-OQ-Z]/g, " ");
                line = line.replaceAll("P", " P");
                line = line + " ";
                let keys = line.split(" ")
                let MCode = Number(keys[0].substring(1))
                waitPCode = Number(keys[1].substring(1))
                if (MCode > 199 && MCode < 999) waitMCode = MCode
            } else if (line.match(".*M.*")) {
                line = line.replaceAll(/[A-LN-Z]/g, " ");
                line = line + " ";
                let keys = line.split(" ")
                let MCode = Number(keys[0].substring(1))
                if (MCode > 199 && MCode < 999) waitMCode = MCode
                else if(MCode == 131 || MCode == 133){
                    waitMCode = MCode
                    waitPCode = 13
                }
                else if(MCode == 82 || MCode == 83 || MCode == 40 || MCode == 41){
                    waitMCode = MCode
                    waitPCode = 12
                }
                else if(MCode == 171 || MCode == 172){
                    waitMCode = MCode
                    waitPCode = 23
                }


            } else if (line.match(".*T.*")) {
                line = line.replaceAll("[A-SU-Z]", " ");
                line = line + " ";
                let keys = line.split(" ")
                let Tnumber = Number(keys[0].substring(1))
                if (Tnumber > 99 && Tnumber < 999) tCode = Tnumber
            }
            return [Number(waitMCode), Number(waitPCode), Number(tCode)]
        }

        let interatorMax = 10000
        if (textAreas.length == 2) {
            let textCodeCanal1 = []
            let textCodeCanal2 = []
            while ((textAreas[0].length > 0 || textAreas[1].length > 0) && interator < 10000) {
                if (textAreas[0].length == 0) textAreas[0].push("")
                if (textAreas[1].length == 0) textAreas[1].push("")
                interator++
                let keyOne = getKeyWords(String(textAreas[0][0]))
                let keyTwo = getKeyWords(textAreas[1][0])



                if (keyOne[0] != 0 && keyOne[0] == keyTwo[0] && keyOne[1] == keyTwo[1] ) {
                    textCodeCanal1.push(textAreas[0][0])
                    textCodeCanal2.push(textAreas[1][0])
                    textAreas[0].shift()
                    textAreas[1].shift()

                    } 
                else{ 
                    if (keyTwo[0] == 0) {
                        textCodeCanal2.push(textAreas[1][0])
                        textAreas[1].shift()
                    }
                    if (keyOne[0] == 0) {
                        textCodeCanal1.push(textAreas[0][0])
                        textAreas[0].shift()
                    }
                    if (keyOne[0] != 0) {
                        textCodeCanal1.push(spaceSybole)
                    }
                    if (keyTwo[0] != 0) {
                        textCodeCanal2.push(spaceSybole)
                    }
                }
                
                if(interator == interatorMax){
                    textCodeCanal1.push(textAreas[0][0])
                    textCodeCanal2.push(textAreas[1][0])
                }
            }
            NtextAreas.push(textCodeCanal1)
            NtextAreas.push(textCodeCanal2)

        }

        if (textAreas.length == 3) {
            let textCodeCanal1 = []
            let textCodeCanal2 = []
            let textCodeCanal3 = []
            while ((textAreas[0].length > 0 || textAreas[1].length > 0 || textAreas[2].length > 0) && interator < interatorMax) {
                if (textAreas[0].length == 0) textAreas[0].push("")
                if (textAreas[1].length == 0) textAreas[1].push("")
                if (textAreas[2].length == 0) textAreas[2].push("")
                interator++
                let keyOne = getKeyWords(String(textAreas[0][0]))
                let keyTwo = getKeyWords(textAreas[1][0])
                let keyTree = getKeyWords(textAreas[2][0])
                if (keyOne[0] != 0 && keyOne[0] == keyTwo[0] && keyOne[0] == keyTree[0] && keyOne[1] == keyTwo[1] && keyOne[1] == keyTree[1]) {
                    textCodeCanal1.push(textAreas[0][0])
                    textCodeCanal2.push(textAreas[1][0])
                    textCodeCanal3.push(textAreas[2][0])
                    textAreas[0].shift()
                    textAreas[1].shift()
                    textAreas[2].shift()
                } else if (keyOne[0] != 0 && keyOne[0] == keyTwo[0] && keyOne[1] == keyTwo[1] && keyOne[1] == 12) {
                    if (keyTree[0] == 0) {
                        textCodeCanal3.push(textAreas[2])
                        textAreas[2].shift()
                    } else {
                        textCodeCanal3.push(spaceSybole)
                    }
                    textCodeCanal1.push(textAreas[0][0])
                    textCodeCanal2.push(textAreas[1][0])
                    textAreas[0].shift()
                    textAreas[1].shift()
                } else if (keyOne[0] != 0 && keyOne[0] == keyTree[0] && keyOne[1] == keyTree[1] && keyTree[1] == 13) {
                    if (keyTwo[0] == 0) {
                        textCodeCanal2.push(textAreas[1])
                        textAreas[1].shift()
                    } else {
                        textCodeCanal2.push(spaceSybole)
                    }
                    textCodeCanal1.push(textAreas[0][0])
                    textCodeCanal3.push(textAreas[2][0])
                    textAreas[0].shift()
                    textAreas[2].shift()
                } else if (keyTwo[0] != 0 && keyTwo[0] == keyTree[0] && keyTwo[1] == keyTree[1] && keyTree[1] == 23) {
                    if (keyOne[0] == 0) {
                        textCodeCanal1.push(textAreas[0])
                        textAreas[0].shift()
                    } else {
                        textCodeCanal1.push(spaceSybole)
                    }
                    textCodeCanal3.push(textAreas[2][0])
                    textCodeCanal2.push(textAreas[1][0])
                    textAreas[2].shift()
                    textAreas[1].shift()

                } else {
                    if (keyTree[0] == 0) {
                        textCodeCanal3.push(textAreas[2][0])
                        textAreas[2].shift()
                    }
                    if (keyTwo[0] == 0) {
                        textCodeCanal2.push(textAreas[1][0])
                        textAreas[1].shift()
                    }
                    if (keyOne[0] == 0) {
                        textCodeCanal1.push(textAreas[0][0])
                        textAreas[0].shift()
                    }
                    if (keyOne[0] != 0) {
                        textCodeCanal1.push(spaceSybole)
                    }
                    if (keyTwo[0] != 0) {
                        textCodeCanal2.push(spaceSybole)
                    }
                    if (keyTree[0] != 0) {
                        textCodeCanal3.push(spaceSybole)
                    }
                }
                if(interator == interatorMax){
                    textCodeCanal1.push(textAreas[0][0])
                    textCodeCanal2.push(textAreas[1][0])
                    textCodeCanal3.push(textAreas[2][0])
                }
                


            }
            
            NtextAreas.push(textCodeCanal1)
            NtextAreas.push(textCodeCanal2)
            NtextAreas.push(textCodeCanal3)
        }

        return NtextAreas
            
    }

    private printConsole: UserError
    private selectedMachineS : string[]
    private readonly controllList = ['STAR_SB_12RG','FANUC_TURN','SR_20JII']
    private readonly controllListS = [['SB12RG_F','FANUC_T','SR20JII_F'],['SB12RG_B','FANUC_T','SR20JII_B'],['SB12RG_F','FANUC_T','SR20JII_F']]

    constructor(printConsole : UserError){
        this.printConsole = printConsole
        this.selectedMachineS = []
        for(let i = 0;i < 3;i++){
            this.selectedMachineS.push("")
        }
    }

    public setSelectedMachine(canal: number, machineName: string) {
        this.selectedMachineS[canal] = machineName
    }

    public getControlListMachine(): string[] {
        return this.controllList
    }
    public getControlListCanal(canal: number): string[] {
        return this.controllListS[canal]
    }

    async plotCNCCode(view3d: any, canalNumbers: number[],programs : string[],toolGeometries: ToolGeometrie[][], ncVariable : NCVariable[][]) {
        async function getData(selectedMachineS : string[], program,canalNumbers: number[])  {
            try {
                let url = "\\cgi-bin\\plot.cgi"
                let requestData = ""
                let machines = [] 
                for(let canal in programs){
                    machines.push(new MachineDataRequest(canalNumbers[canal],selectedMachineS[canalNumbers[canal]],program[canal].replace(/\(.*\)/g, ""),toolGeometries[canal],ncVariable[canal]))
               }
                const config = {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'Content-Type: application/json',
                    },
                    body: JSON.stringify(machines)

                }
                //console.log(config.data)
                let response = await fetch(url, config)
                return response.json()                    
            } 
            catch (error) {          
            }
            return null
        }
        return await getData(this.selectedMachineS,programs,canalNumbers)as unknown as MachineResponse

        
    }

}

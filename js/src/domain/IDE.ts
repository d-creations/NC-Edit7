// if use closre compile 
// ==ClosureCompiler==
// @language_out ecmascript5
// @compilation_level SIMPLE_OPTIMIZATIONS
// ==/ClosureCompiler==


/**
 * autor : roth 
 * date : 2023
 * 
 * Editor class 
 * 
 * A CNC Editor for multiply Canals  
 *              it uses a 3dView to plot proram code 
 *              e Console to print CNC Program errors for the User
*               
 */
import {CanalAdapter} from './canalAdapter.js';
import {ExampleCreator} from '../technicalService/ExampleCreator.js';
import { NCToolManager, NCToolManagerCreator } from './NCToolManager.js';
import { MachineManagerAdapter } from './MachineManagerAdapter.js';
import { NCVariableManager, NCVariableManagerCreator } from './NCVariableManager.js';
import { Observable, Observer } from '../technicalService/observer.js';
import { UserError } from '../technicalService/error/userError.js';

export class IDE extends Observable implements Observer {

    getCanalsCount(): number {
        return this.canals.length
    }


    parentDiv;
    static view3d: any;
    static canals: Array<CanalAdapter> = [];
    static canalExecs: Array<CanalAdapter> = [];
    private printConsole;
    private exampleCreator : ExampleCreator
    static CompleteTime : Number
    private runCalctime : string= ""
    private canalCreationFunciton : any
    private toolManagerCreator  : NCToolManagerCreator
    private variableManagerCreator : NCVariableManagerCreator
    private toolManagers : NCToolManager[] = []
    private variableManagers : NCVariableManager[] = []
    private machineManager : MachineManagerAdapter
    static waitTable: HTMLTableElement

    
    constructor(parentDiv: HTMLDivElement, canalCount: number, view3d: any, printConsole: UserError, canalCreationFunciton : any, toolManagerCreator : NCToolManagerCreator,variableManagerCreator : NCVariableManagerCreator,machineManager : MachineManagerAdapter) {
        super()
        this.exampleCreator = new ExampleCreator()
        this.parentDiv = parentDiv;
        IDE.view3d = view3d;
        this.printConsole = printConsole
        this.canalCreationFunciton = canalCreationFunciton
        this.toolManagerCreator = toolManagerCreator
        this.variableManagerCreator = variableManagerCreator

        this.machineManager = machineManager
    }



    public createIDE( canalDiv: HTMLDivElement[],canalExecDiv : HTMLDivElement[], toolManagerDiv: HTMLDivElement[],varManagerDiv : HTMLDivElement[]) {


        if (canalDiv.length < 1)
            throw new Error("Canal count Wrong");
        while (0 < IDE.canals.length)
            IDE.canals.pop()//.destroyCanal()
            while (0 < IDE.canalExecs.length)
            IDE.canalExecs.pop()//.destroyCanal()
        
        for (let i = IDE.canals.length; i < canalDiv.length; i++) {
            IDE.canals.push(new CanalAdapter(i + 1, IDE.view3d,canalDiv[i],this.canalCreationFunciton,false,false));
            IDE.canalExecs.push(new CanalAdapter(i + 10, IDE.view3d,canalExecDiv[i],this.canalCreationFunciton,true,true));

            let toolManager = this.toolManagerCreator.createToolManager()
            toolManager.appendTableTo(toolManagerDiv[i])
            this.toolManagers.push(toolManager)

            let variableManager = this.variableManagerCreator.createVariableManager()
            variableManager.appendTableTo(varManagerDiv[i])
            this.variableManagers.push(variableManager)

        }
        this.canals.forEach(canal => {
            canal.restoreText();
            canal.addObserver(this);
        });

    }

    getTextFromCanal(canalnr : number) {
        return this.canals[canalnr].text
    }
    getCalcTime(): string {
        return String(IDE.CompleteTime)
    }

    public getCanalKeyList(canal: number) {
        if (canal < this.canals.length)
        return this.canals[canal].keyElementList
        else
        return [] 
    }
    public setTimeLineVisible(checked: boolean) {
        if (checked) this.canals.forEach(canal => {canal.timeLineVisible(true)});
        else this.canals.forEach(canal => {canal.timeLineVisible(false)});
    }
    public loadExampleProgram() {
        {
            let programms = this.exampleCreator.getExample(this.canals.length,this)
        }
    }
    public allCanalClear() {
        this.canals.forEach(canal => {canal.clearText()});
    }

    
    public controlListCanal(canal: number): string[] {
        return this.machineManager.getControlListCanal(canal)
    }

    undoCanal(canal: number) {
        IDE.canals[canal].undo()
    }
    redoCanal(canal: number) {
        IDE.canals[canal].redo()
    }
    addSpaceCanal(canal: number) {
        IDE.canals[canal].addSpace()
    }
    removeSpaceCanal(canal: number) {
        IDE.canals[canal].removeSpace()
    }

    openSearchBox(canal: number){
        IDE.canals[canal].openSearchBox()
    }

    public controlListMachine(): string[] {
        return this.machineManager.getControlListMachine()
    }
    public setSelectedMachine(canal: number, machineName: string) {
        this.machineManager.setSelectedMachine(canal,machineName)
    }
    public setTextToCanal(canalIndex: number, text: string) {
        if(canalIndex < this.canals.length)
            this.canals[canalIndex].text = text
    }

/**
 * update for the obsever
 */
    public OberverUpdate(): void {
        this.printConsole.printMessage("")// reset message
        this.updated()
    }

    public plotNextLine(){
       // IDE.canals.forEach(canal => canal.plotNextLine())
    } 

    public plotPreveusLine(){
        //IDE.canals.forEach(canal => canal.plotPreveousLine())
    } 

    static clearPlot(){
        IDE.canals.forEach(canal => canal.resetPlotPosition())
    } 
    public clearPlot(){
        IDE.canals.forEach(canal => canal.resetPlotPosition())
    } 


    static setRadius(radius : string){
        IDE.view3d.setPointRadius(Number(radius))
    } 


    
    



 



    public plotCNCCode(view3d: any, printConsole: UserError,canalNumbers : Array<number>){
        let programs = []
        for(let canalNumber of canalNumbers){
            if (canalNumber <= this.canals.length)programs.push(this.canals[canalNumber].text)
        }
        let toolGeometries = []
        this.toolManagers.forEach((toolManager)=>toolGeometries.push(toolManager.getToolFile()))
        let ncVariables = []
        this.variableManagers.forEach((variableManager) => ncVariables.push(variableManager.getToolFile()))
        
        this.machineManager.plotCNCCode(view3d,canalNumbers,programs,toolGeometries,ncVariables ).then((response) => {
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
                    let plotlineEdit = Array.apply(null,Array(IDE.canals[resp_canal.canalNr].getLength())).map(function(x,i){return [];})
                    let plotlinesExec = []
                    let timeLineListEdit = Array.apply(null,Array(IDE.canals[resp_canal.canalNr].getLength())).map(function(x,i){return ["-:--"];})
                    if (resp_canal.plot.length > programIndex && resp_canal.plot.length > 0) {
                        
                        for (let i = 0; i < resp_canal.plot.length; i++) {
                            line_index = i;
                            plotlineEdit[resp_canal.programExec[i]].push(resp_canal.plot[line_index]);

                            plotlinesExec.push([resp_canal.plot[i]])
                            view3d.plot(resp_canal.plot[line_index]);
                            let t = String(resp_canal.plot[line_index].t);
                            let time_t = parseFloat(t);
                            time += time_t;
                            t = String(time_t.toFixed(2));
                            if (t.length > 4)
                                t = t.substring(0, 4);
                            timeLineList.push(t);
                            timeLineListEdit[resp_canal.programExec[i]] = t
                        }
                        IDE.canals[resp_canal.canalNr].timeLine = timeLineListEdit;
                        IDE.canalExecs[resp_canal.canalNr].timeLine = timeLineList;
                    }
                    times.push(time);
                    programIndex += 1;
                    this.canals[resp_canal.canalNr].resetPlotPosition();

                    this.canals[resp_canal.canalNr].plotLines = plotlineEdit;

                    let execProgram = resp_canal.programExec;
                    let execText = ""
                    let program = IDE.canals[resp_canal.canalNr].text.split("\n")
                    for(let line of execProgram){
                        execText += program[line]+"\n"
                    }
                    IDE.canalExecs[resp_canal.canalNr].plotLines = plotlinesExec;
                    IDE.canalExecs[resp_canal.canalNr].text = execText

                }
                IDE.CompleteTime = times[0].toFixed(2);
                this.updated()
            }
            })
        
     }



    public sync_scroll() {
        IDE.canals.forEach((canal1) => {
            IDE.canals.forEach((canal2) => {
                if (canal1 != canal2) {
                    canal2.bindScrollTop(canal1);
                    canal2.bindScrollLeft(canal2);
                }
            })
        })

    }

    public updateToolNumber(){
//        this.canals.forEach(canal => canal.updateLineNumber());
    }

    public sync_scrollOff() {
        IDE.canals.forEach((canal) => {
            canal.unbindAllSyncScrollLeft()   
            canal.unbindAllSyncScrollTop()
        })
    }

    public sync_waitCodeOff() {
        let spaceSybole = "\u2002"
        for (let canal in IDE.canals) {
            while (IDE.canals[canal].text.indexOf("\n"+spaceSybole+"\n")>1) {
                IDE.canals[canal].text = IDE.canals[canal].text.replaceAll("\n"+spaceSybole+"\n", "\n")
            }
        }
    }

    public sync_waitCode(){        
        let spaceSybole = "\u2002"
        this.sync_waitCodeOff();//reset 
        let textAreas = []
        let NtextAreas = []
        for (let canal in IDE.canals) {
            let t = IDE.canals[canal].text

            let text = t.split("\n")
            textAreas.push(text)
        }
        NtextAreas = this.machineManager.sync_waitCode(textAreas,spaceSybole)
            if (NtextAreas[0].length >= 9999) {
                let message = ""
                for(let text in NtextAreas){
                    let num = Number(text) + 1
                    message += "HEAD"+num + " "+ NtextAreas[text][NtextAreas[text].length -1]
                }
                this.printConsole.printMessage("There is an error with the wait code\n "+ message);
                return false
            }
            else{
                for (let canal in IDE.canals) {
                    let text = ""
                    for (let line in NtextAreas[canal]) {
                        text = text + NtextAreas[canal][line] + "\n"
                    }
                     IDE.canals[canal].text = text
                }
            
        }
        return true
    }



    get canals(): Array<CanalAdapter> {
        return IDE.canals;
    }
}









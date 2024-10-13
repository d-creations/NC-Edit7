/**
 * autor : roth 
 * date : 2024
 * 
 * IDEAdapter 
 * 
 * A CNC Editor for multiply Canals  
 *              it uses a 3dView to plot proram code 
 *              e Console to print CNC Program errors for the User
*               
* Lizenz:
* MIT License

Copyright (c) 2024 damian-roth Switzerland

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

* 
 */

import { UserError } from '../technicalService/error/userError.js';
import { Observer } from '../technicalService/observer.js';
import { FileHandler_I } from './fileHandler_I.js';
import { IDEAdapter } from './IDEAdapter.js';
import { IDEView } from './IDEView.js';



export class ApplicationMessage{

    command : string
    textValue : string

    constructor(command : string , textValue : string){
        this.command = command
        this.textValue = textValue
    }
}
export enum Chanals {
    multi,
    one,
    two,
    tree,
    none
  }
export class WebPageFileHandler implements FileHandler_I,Observer {

    
    readonly parentDiv : HTMLDivElement;
    private SaveFileDiv: HTMLDivElement
    private loadFileDiv: HTMLDivElement
    readonly editor: IDEAdapter;
    private IDEView : IDEView
    readonly userError : UserError
    private chanal : Chanals
    private comunicationPort : MessagePort

    constructor(editor: IDEAdapter, parentDiv: HTMLDivElement, IDEView : IDEView, userError : UserError) {        
        this.editor = editor;
        this.parentDiv = parentDiv;
        this.IDEView = IDEView;
        this.userError = userError
        this.chanal = Chanals.none
        this.editor.addViewObserver(this)
        var that = this
        window.addEventListener("message",(event)=>{
            console.log("gotinit message iframe")
            this.comunicationPort = event.ports[0]
            this.comunicationPort.onmessage = (event)=>{
                
                let data : ApplicationMessage  = event.data
                      console.log("got " + event)
        
                      

                      if(data.command == "saveText"){
                        this.createSaveDiv();
                      }
                      if(data.command == "setText"){
                        
                        that.createWhereToLoadDiv(data.textValue)
                        console.log("iframe set Text\n")
                      }
                    }
    
                })

    }
    private saveText(editor: IDEAdapter) {
        let textData = "";
        if (this.chanal == Chanals.one || this.chanal == Chanals.none) textData = editor.getTextFromCanal(0);
        if (this.chanal == Chanals.two) textData = editor.getTextFromCanal(1);
        if (this.chanal == Chanals.tree) textData = editor.getTextFromCanal(2);
        if (this.chanal == Chanals.multi) textData = this.createMultiProgram(editor);
        console.log(textData);

        let retObject = {
            command: "storeText",
            textValue: textData
        };
        console.log("iframe past Save Text \n");
        this.comunicationPort.postMessage(retObject);
        if(this.parentDiv.contains(this.SaveFileDiv)){
            this.parentDiv.removeChild(this.SaveFileDiv)
        }
    }

    OberverUpdate(): void {
        console.log("textCanged")
    }
    createMultiProgram(editor: IDEAdapter) {
        let canals : number= this.editor.getCanalsCount()
        let text = ""

        
        let canaltext = this.editor.getTextFromCanal(0)
        let Onumber = ExtractPogramnummber(canaltext);
        text = text + "%\n"
        text = text + "&F=/O"+Onumber
        text = text + "/\n"

        for(let i = 0;i<canals;i++){
            let canaltext = this.editor.getTextFromCanal(i)
            let Onumber = ExtractPogramnummber(canaltext);
            text = text + "<O"+Onumber+".P"+(i+1)+">\n"
            text = text + canaltext.substring(canaltext.indexOf("\n"))
        }
        text = text + "%\n"
        return text


        function ExtractPogramnummber(canaltext: string) {
            let head = canaltext.substring(0, canaltext.indexOf("\n", 0));
            if (canaltext.indexOf("O")) this.userError.printMessage("O NUMBER NOT FOUND");
            let prgrmName = head.substring(canaltext.indexOf("O") + 1);
            let Onumber = "";
            for (let n of prgrmName) {
                if (Number(n) <= 9) {
                    Onumber = Onumber + n;
                }
                else {
                    break;
                }
            }
            return Onumber;
        }
    }

    private setTextToTextArea(this: WebPageFileHandler, result: string | ArrayBuffer | null) {
        if (result != null) {
            let list: string[] = this.phraseNCCode(result)
//            this.editor.createCanalIfNotExist(list.length);
            this.IDEView.changeCanalCount(list.length)
            if (list.length > 0) {
                this.editor.setTextToCanal(0,list[0].replaceAll("\r",""))
            }
            if (list.length > 1) {
                this.editor.setTextToCanal(1,list[1].replaceAll("\r",""))

            }
            if (list.length > 2) {
                
                
                this.editor.setTextToCanal(2,list[2].replaceAll("\r",""))
            }
            this.closeWhereToLoadDiv()
        }
    }

    private phraseNCCode(result: string | ArrayBuffer): string[] {
        if(result.toString().includes("<")){
            this.chanal = Chanals.multi
        }
        let selction = document.querySelector('input[name="programTypeSelection"]:checked');
        if (selction != null){
            if (selction.id == "multi"){ 
                this.chanal = Chanals.multi
            }
            else if (selction.id == "2"){
                this.chanal = Chanals.two
            }
            else if (selction.id == "3"){
                this.chanal = Chanals.tree
            }
            else{
                this.chanal = Chanals.one                
            }
            
        }
        if (this.chanal == Chanals.multi) {
            result = result.toString().replaceAll(/&F=.*/g, "")
            result = result.toString().replaceAll("%", "")
            let ret: string[] = [];
            let programs: string[] = result.toString().split("<");
            programs.shift() // first is nothing


            
            for (let programNr in programs) {
                if(Number(programNr) > 2) break;
                let programName: string[] = programs[programNr].split("\n");
                let startNameIndex = 0
                let endNameIndex = programName[0].indexOf(".")
                if (endNameIndex == -1) {
                    endNameIndex = programName[0].length - 1
                }
                let programNameS = programName[0].substring(startNameIndex, endNameIndex).replace("<", "");
                programNameS = programNameS.replace(/\..*\./, "");
                ret.push(programNameS + programs[programNr].replace(/.*>/, ""));
            }
            return ret;
        }         
        else if(this.chanal == Chanals.two){
            return Array.of("",result.toString())
        }
        else if(this.chanal == Chanals.tree){
            return Array.of("","",result.toString())
        }else {
            return Array.of(result.toString())

        }
    }

    closeWhereToLoadDiv(){
        if(this.parentDiv.contains(this.loadFileDiv)){
            this.parentDiv.removeChild(this.loadFileDiv)
        }
    }

    private createWhereToLoadDiv(this: WebPageFileHandler, result: string | ArrayBuffer | null){
        if(this.parentDiv.contains(this.loadFileDiv)){
                    this.parentDiv.removeChild(this.loadFileDiv)
        }
        this.loadFileDiv = document.createElement('div')
        this.loadFileDiv.classList.add("fileLoadSelector")
        let loadFileButton = document.createElement('button')
        loadFileButton.textContent = "load File"
        loadFileButton.style.backgroundColor = "green"
        let ProgramTypeSelection = document.createElement('form')

        let names = ['1', '2', '3', 'multi']
        for (let key in names) {
            let opt = document.createElement('input');
            opt.type = "radio"
            opt.id = names[key]
            opt.name = "programTypeSelection"
            opt.classList.add("radio")
            var label = document.createElement('label');
            label.htmlFor = names[key]
            label.innerHTML = names[key]
            ProgramTypeSelection.appendChild(opt);
            ProgramTypeSelection.appendChild(label);
        }

        loadFileButton.addEventListener('click', () => this.setTextToTextArea(result));
        this.loadFileDiv.appendChild(loadFileButton)
        this.loadFileDiv.appendChild(ProgramTypeSelection)
        this.parentDiv.appendChild(this.loadFileDiv)
    }


    private createSaveDiv(this: WebPageFileHandler){
        console.log("SAVE TEXT")
        if(this.parentDiv.contains(this.SaveFileDiv)){
                    this.parentDiv.removeChild(this.SaveFileDiv)
        }
        this.SaveFileDiv = document.createElement('div')
        this.SaveFileDiv.classList.add("fileLoadSelector")
        let loadFileButton = document.createElement('button')
        loadFileButton.addEventListener('click', () => this.saveText(this.editor));
        loadFileButton.textContent = "Save File"
        loadFileButton.style.backgroundColor = "green"
        let ProgramTypeSelection = document.createElement('form')

        let names = ['multi\singelfile']
        for (let key in names) {
            let opt = document.createElement('input');
            opt.type = "radio"
            opt.id = names[key]
            opt.name = "programTypeSelection"
            opt.classList.add("radio")
            var label = document.createElement('label');
            label.htmlFor = names[key]
            label.innerHTML = names[key]
            ProgramTypeSelection.appendChild(opt);
            ProgramTypeSelection.appendChild(label);
        }


        this.SaveFileDiv.appendChild(loadFileButton)
        this.SaveFileDiv.appendChild(ProgramTypeSelection)
        this.parentDiv.appendChild(this.SaveFileDiv)
    }



}
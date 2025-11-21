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
import { FileHandler_I } from './fileHandler_I.js';
import { IDEAdapter } from './IDEAdapter.js';
import { IDEView } from './IDEView.js';


export class FileHandler implements FileHandler_I {

    readonly parentDiv;
    readonly chooseFileButton: HTMLButtonElement;
    readonly loadFileButton: HTMLButtonElement;
    readonly closeDialog: HTMLButtonElement;
    readonly loadFileDiv: HTMLDivElement
    readonly input: HTMLInputElement;
    readonly ProgramTypeSelection: HTMLFormElement;
    readonly editor: IDEAdapter;
    private IDEView : IDEView
    readonly userError : UserError
    

    constructor(editor: IDEAdapter, parentDiv: HTMLDivElement, IDEView : IDEView, userError : UserError) {
        this.editor = editor;
        this.parentDiv = parentDiv;
        this.IDEView = IDEView;
        this.loadFileDiv = document.createElement('div')
        this.userError = userError
        this.loadFileButton = document.createElement('button')
        this.loadFileButton.addEventListener('click', () => this.uploadFile());
        this.loadFileButton.textContent = "load File"
        this.closeDialog = document.createElement('button')
        this.closeDialog.addEventListener('click', () => this.setChooseFileButton());
        this.closeDialog.textContent = "close"
        this.input = document.createElement('input')
        this.input.type = 'file'
        this.input.accept = '*,*'
        this.loadFileButton.style.backgroundColor = "green"
        this.ProgramTypeSelection = document.createElement('form')

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
            this.ProgramTypeSelection.appendChild(opt);
            this.ProgramTypeSelection.appendChild(label);
        }


        this.loadFileDiv.appendChild(this.loadFileButton)
        this.loadFileDiv.appendChild(this.input)
        this.loadFileDiv.appendChild(this.ProgramTypeSelection)


        this.chooseFileButton = document.createElement('button');
        this.chooseFileButton.textContent = "Load New File"
        this.chooseFileButton.addEventListener('click', () => this.setFileLoadButton())
        this.parentDiv.appendChild(this.loadFileDiv)
        this.setChooseFileButton()

    }


    private setFileLoadButton(this: FileHandler) {
        this.parentDiv.removeChild(this.chooseFileButton)
        this.loadFileDiv.appendChild(this.loadFileButton)
        this.loadFileDiv.appendChild(this.closeDialog)
        this.loadFileDiv.appendChild(this.ProgramTypeSelection)
        this.parentDiv.appendChild(this.loadFileDiv)
        this.input.click()
    }

    private setChooseFileButton(this: FileHandler) {
        this.parentDiv.removeChild(this.loadFileDiv)
        this.parentDiv.appendChild(this.chooseFileButton)
    }


    private phraseNCCode(result: string | ArrayBuffer): string[] {
        let isMultiProgram = false
        isMultiProgram = result.toString().includes("<")
        let chanal = 1
        let selction = document.querySelector('input[name="programTypeSelection"]:checked');
        if (selction != null){
            if (selction.id == "multi"){ isMultiProgram = true}
            else if (selction.id == "2"){
                chanal = 2
            }
            else if (selction.id == "3"){
                chanal = 3
            }
            
        }
        if (isMultiProgram) {
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
        else if(chanal == 2){
            return Array.of("",result.toString())
        }
        else if(chanal == 3){
            return Array.of("","",result.toString())
        }else {
            return Array.of(result.toString())

        }
    }

    private setTextToTextArea(this: FileHandler, result: string | ArrayBuffer | null) {
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
        }

        this.setChooseFileButton()
        // Clear uncommitted changes flag after loading a file
        if (typeof window !== 'undefined') {
            (window as any).hasUncommittedChanges = false;
        }
    }

    uploadFile(this: FileHandler): void {
        if (this.input.files != null) {
            const [file] = this.input.files;
            const reader = new FileReader();
            reader.addEventListener(
                "load",
                () => {
                    this.setTextToTextArea(reader.result);
                },
                false
            );

            if (file) {
                reader.readAsText(file);
            }
            this.input.value = "";
        } else {
            this.userError.printMessage("No File Selected")
            // no file chosen
        }

    }

}
export class FileHandler {
    constructor(editor, parentDiv, IDEView, userError) {
        this.editor = editor;
        this.parentDiv = parentDiv;
        this.IDEView = IDEView;
        this.loadFileDiv = document.createElement('div');
        this.userError = userError;
        this.loadFileButton = document.createElement('button');
        this.loadFileButton.addEventListener('click', () => this.uploadFile());
        this.loadFileButton.textContent = "load File";
        this.closeDialog = document.createElement('button');
        this.closeDialog.addEventListener('click', () => this.setChooseFileButton());
        this.closeDialog.textContent = "close";
        this.input = document.createElement('input');
        this.input.type = 'file';
        this.input.accept = '*,*';
        this.loadFileButton.style.backgroundColor = "green";
        this.ProgramTypeSelection = document.createElement('form');
        let names = ['1', '2', '3', 'multi'];
        for (let key in names) {
            let opt = document.createElement('input');
            opt.type = "radio";
            opt.id = names[key];
            opt.name = "programTypeSelection";
            opt.classList.add("radio");
            var label = document.createElement('label');
            label.htmlFor = names[key];
            label.innerHTML = names[key];
            this.ProgramTypeSelection.appendChild(opt);
            this.ProgramTypeSelection.appendChild(label);
        }
        this.loadFileDiv.appendChild(this.loadFileButton);
        this.loadFileDiv.appendChild(this.input);
        this.loadFileDiv.appendChild(this.ProgramTypeSelection);
        this.chooseFileButton = document.createElement('button');
        this.chooseFileButton.textContent = "Load New File";
        this.chooseFileButton.addEventListener('click', () => this.setFileLoadButton());
        this.parentDiv.appendChild(this.loadFileDiv);
        this.setChooseFileButton();
    }
    setFileLoadButton() {
        this.parentDiv.removeChild(this.chooseFileButton);
        this.loadFileDiv.appendChild(this.loadFileButton);
        this.loadFileDiv.appendChild(this.closeDialog);
        this.loadFileDiv.appendChild(this.ProgramTypeSelection);
        this.parentDiv.appendChild(this.loadFileDiv);
        this.input.click();
    }
    setChooseFileButton() {
        this.parentDiv.removeChild(this.loadFileDiv);
        this.parentDiv.appendChild(this.chooseFileButton);
    }
    phraseNCCode(result) {
        let isMultiProgram = false;
        isMultiProgram = result.toString().includes("<");
        let chanal = 1;
        let selction = document.querySelector('input[name="programTypeSelection"]:checked');
        if (selction != null) {
            if (selction.id == "multi") {
                isMultiProgram = true;
            }
            else if (selction.id == "2") {
                chanal = 2;
            }
            else if (selction.id == "3") {
                chanal = 3;
            }
        }
        if (isMultiProgram) {
            result = result.toString().replaceAll(/&F=.*/g, "");
            result = result.toString().replaceAll("%", "");
            let ret = [];
            let programs = result.toString().split("<");
            programs.shift();
            for (let programNr in programs) {
                if (Number(programNr) > 2)
                    break;
                let programName = programs[programNr].split("\n");
                let startNameIndex = 0;
                let endNameIndex = programName[0].indexOf(".");
                if (endNameIndex == -1) {
                    endNameIndex = programName[0].length - 1;
                }
                let programNameS = programName[0].substring(startNameIndex, endNameIndex).replace("<", "");
                programNameS = programNameS.replace(/\..*\./, "");
                ret.push(programNameS + programs[programNr].replace(/.*>/, ""));
            }
            return ret;
        }
        else if (chanal == 2) {
            return Array.of("", result.toString());
        }
        else if (chanal == 3) {
            return Array.of("", "", result.toString());
        }
        else {
            return Array.of(result.toString());
        }
    }
    setTextToTextArea(result) {
        if (result != null) {
            let list = this.phraseNCCode(result);
            this.IDEView.changeCanalCount(list.length);
            if (list.length > 0) {
                this.editor.setTextToCanal(0, list[0].replaceAll("\r", ""));
            }
            if (list.length > 1) {
                this.editor.setTextToCanal(1, list[1].replaceAll("\r", ""));
            }
            if (list.length > 2) {
                this.editor.setTextToCanal(2, list[2].replaceAll("\r", ""));
            }
        }
        this.setChooseFileButton();
        if (typeof window !== 'undefined') {
            window.hasUncommittedChanges = false;
        }
    }
    uploadFile() {
        if (this.input.files != null) {
            const [file] = this.input.files;
            const reader = new FileReader();
            reader.addEventListener("load", () => {
                this.setTextToTextArea(reader.result);
            }, false);
            if (file) {
                reader.readAsText(file);
            }
            this.input.value = "";
        }
        else {
            this.userError.printMessage("No File Selected");
        }
    }
}

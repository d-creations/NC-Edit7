export class ApplicationMessage {
    constructor(command, textValue, info) {
        this.command = command;
        this.textValue = textValue;
        this.info = info;
    }
}
export var Chanals;
(function (Chanals) {
    Chanals[Chanals["multi"] = 0] = "multi";
    Chanals[Chanals["one"] = 1] = "one";
    Chanals[Chanals["two"] = 2] = "two";
    Chanals[Chanals["tree"] = 3] = "tree";
    Chanals[Chanals["none"] = 4] = "none";
})(Chanals || (Chanals = {}));
export class WebPageFileHandler {
    constructor(editor, parentDiv, IDEView, userError) {
        this.editor = editor;
        this.parentDiv = parentDiv;
        this.IDEView = IDEView;
        this.userError = userError;
        this.chanal = Chanals.none;
        this.editor.addViewObserver(this);
        var that = this;
        window.addEventListener("message", (event) => {
            this.comunicationPort = event.ports[0];
            this.comunicationPort.onmessage = (event) => {
                let data = event.data;
                if (data.command == "saveAsText")
                    this.openSaveDialog();
                else if (data.command == "saveText") {
                    if (editor.getCanalsCount() == 1 && this.chanal == Chanals.one)
                        this.saveText(this.editor);
                    else if (editor.getCanalsCount() == 2 && this.chanal == Chanals.two)
                        this.saveText(this.editor);
                    else if (editor.getCanalsCount() == 3 && this.chanal == Chanals.tree)
                        this.saveText(this.editor);
                    else if (editor.getCanalsCount() > 3 && this.chanal == Chanals.multi)
                        this.saveText(this.editor);
                    this.saveText(this.editor);
                }
                else if (data.command == "setTextAs")
                    that.openOpenDialog(data.textValue);
                else if (data.command == "setText")
                    this.formateNCTextToChanalList(data.textValue);
            };
        });
    }
    saveText(editor) {
        if (this.chanal == Chanals.one && this.editor.getCanalsCount() == 1)
            this.storeTextExec(editor, "", "storeText");
        else if (this.chanal == Chanals.multi && this.editor.getCanalsCount() > 1)
            this.storeTextExec(editor, "", "storeText");
        else
            this.storeTextExec(editor, "name", "storeText");
    }
    saveTextAs(editor, name) {
        this.storeTextExec(editor, name, "storeTextAs");
    }
    storeTextExec(editor, name, command) {
        let textData = "";
        let chanal = this.chanal;
        if (chanal == Chanals.one || chanal == Chanals.none)
            textData = editor.getTextFromCanal(0);
        else if (chanal == Chanals.two)
            textData = editor.getTextFromCanal(1);
        else if (chanal == Chanals.tree)
            textData = editor.getTextFromCanal(2);
        else
            textData = this.createMultiProgram(editor);
        let retObject = {
            command: command,
            textValue: textData,
            info: name
        };
        this.comunicationPort.postMessage(retObject);
        this.closeSaveDialog();
        if (typeof window !== 'undefined') {
            window.hasUncommittedChanges = false;
        }
    }
    getCanalOfEditor(editor) {
        let canals = editor.getCanalsCount();
        if (canals == 1)
            return Chanals.one;
        else
            return Chanals.multi;
    }
    closeSaveDialog() {
        if (this.parentDiv.contains(this.SaveFileDiv)) {
            this.parentDiv.removeChild(this.SaveFileDiv);
        }
    }
    OberverUpdate() {
    }
    createMultiProgram(editor) {
        let canals = this.editor.getCanalsCount();
        let text = "";
        let canaltext = this.editor.getTextFromCanal(0);
        let Onumber = ExtractPogramnummber(canaltext);
        text = text + "%\n";
        text = text + "&F=/O" + Onumber;
        text = text + "/\n";
        for (let i = 0; i < canals; i++) {
            let canaltext = this.editor.getTextFromCanal(i);
            let Onumber = ExtractPogramnummber(canaltext);
            text = text + "<O" + Onumber + ".P" + (i + 1) + ">\n";
            text = text + canaltext.substring(canaltext.indexOf("\n"));
        }
        text = text + "%\n";
        return text;
        function ExtractPogramnummber(canaltext) {
            let head = canaltext.substring(0, canaltext.indexOf("\n", 0));
            if (canaltext.indexOf("O"))
                this.userError.printMessage("O NUMBER NOT FOUND");
            let prgrmName = head.substring(canaltext.indexOf("O") + 1);
            let Onumber = "";
            for (let n of prgrmName) {
                if (Number(n) <= 9)
                    Onumber = Onumber + n;
                else
                    break;
            }
            return Onumber;
        }
    }
    setTextToTextArea(result) {
        let canals = this.getSelectedChanal(String(result));
        if (result != null) {
            if (canals == Chanals.multi) {
                let list = this.formateNCTextToChanalList(result);
                this.IDEView.changeCanalCount(list.length);
                if (list.length > 0)
                    this.editor.setTextToCanal(0, list[0].replaceAll("\r", ""));
                else if (list.length > 1)
                    this.editor.setTextToCanal(1, list[1].replaceAll("\r", ""));
                else if (list.length > 2)
                    this.editor.setTextToCanal(2, list[2].replaceAll("\r", ""));
            }
            else if (canals = Chanals.one) {
                if (this.editor.getCanalsCount() < 1)
                    this.IDEView.changeCanalCount(1);
                this.editor.setTextToCanal(0, String(result).replaceAll("\r", ""));
            }
            else if (canals = Chanals.two) {
                if (this.editor.getCanalsCount() < 1)
                    this.IDEView.changeCanalCount(1);
                this.editor.setTextToCanal(0, String(result).replaceAll("\r", ""));
            }
            else if (canals = Chanals.tree) {
                if (this.editor.getCanalsCount() < 1)
                    this.IDEView.changeCanalCount(1);
                this.editor.setTextToCanal(0, String(result).replaceAll("\r", ""));
            }
            if (typeof window !== 'undefined') {
                window.hasUncommittedChanges = false;
            }
        }
    }
    formateNCTextToChanalList(result) {
        let chanal = this.getSelectedChanal(String(result));
        if (chanal == Chanals.multi) {
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
        else if (this.chanal == Chanals.two)
            return Array.of("", result.toString());
        else if (this.chanal == Chanals.tree)
            return Array.of("", "", result.toString());
        else
            return Array.of(result.toString());
    }
    getSelectedChanal(ProgramText) {
        if (ProgramText != null && ProgramText.toString().includes("<")) {
            this.chanal = Chanals.multi;
        }
        else {
            let selction = document.querySelector('input[name="programTypeSelection"]:checked');
            if (selction != null) {
                if (selction.id == "multi")
                    this.chanal = Chanals.multi;
                else if (selction.id == "2")
                    this.chanal = Chanals.two;
                else if (selction.id == "3")
                    this.chanal = Chanals.tree;
                else
                    this.chanal = Chanals.one;
            }
            this.closeOpenDialog();
        }
        return this.chanal;
    }
    closeOpenDialog() {
        if (this.parentDiv.contains(this.loadFileDiv)) {
            this.parentDiv.removeChild(this.loadFileDiv);
        }
    }
    openOpenDialog(result) {
        if (this.parentDiv.contains(this.loadFileDiv)) {
            this.parentDiv.removeChild(this.loadFileDiv);
        }
        this.loadFileDiv = document.createElement('div');
        this.loadFileDiv.classList.add("fileLoadSelector");
        let loadFileButton = document.createElement('button');
        loadFileButton.textContent = "load File";
        loadFileButton.style.backgroundColor = "green";
        let ProgramTypeSelection = document.createElement('form');
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
            ProgramTypeSelection.appendChild(opt);
            ProgramTypeSelection.appendChild(label);
        }
        loadFileButton.addEventListener('click', () => this.setTextToTextArea(result));
        this.loadFileDiv.appendChild(loadFileButton);
        this.loadFileDiv.appendChild(ProgramTypeSelection);
        this.parentDiv.appendChild(this.loadFileDiv);
    }
    openSaveDialog() {
        if (this.parentDiv.contains(this.SaveFileDiv)) {
            this.parentDiv.removeChild(this.SaveFileDiv);
        }
        this.SaveFileDiv = document.createElement('div');
        this.SaveFileDiv.classList.add("fileLoadSelector");
        let loadFileButton = document.createElement('button');
        loadFileButton.addEventListener('click', () => this.saveTextAs(this.editor, "PROGRAM.txt"));
        loadFileButton.textContent = "Save File";
        loadFileButton.style.backgroundColor = "green";
        let ProgramTypeSelection = document.createElement('form');
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
            ProgramTypeSelection.appendChild(opt);
            ProgramTypeSelection.appendChild(label);
        }
        let programNameInput = document.createElement('input');
        programNameInput.type = "text";
        programNameInput.id = "programName";
        programNameInput.name = "programName";
        programNameInput.placeholder = "Enter program name";
        ProgramTypeSelection.appendChild(programNameInput);
        this.SaveFileDiv.appendChild(loadFileButton);
        this.SaveFileDiv.appendChild(ProgramTypeSelection);
        this.parentDiv.appendChild(this.SaveFileDiv);
    }
}

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
                if (data.command == "saveAsText") {
                    this.createSaveDiv();
                }
                if (data.command == "setText") {
                    that.createWhereToLoadDiv(data.textValue);
                }
            };
        });
    }
    saveText(editor) {
        let textData = "";
        if (this.chanal == Chanals.one || this.chanal == Chanals.none)
            textData = editor.getTextFromCanal(0);
        if (this.chanal == Chanals.two)
            textData = editor.getTextFromCanal(1);
        if (this.chanal == Chanals.tree)
            textData = editor.getTextFromCanal(2);
        if (this.chanal == Chanals.multi)
            textData = this.createMultiProgram(editor);
        let retObject = {
            command: "storeText",
            textValue: textData,
            info: "program.txt"
        };
        this.comunicationPort.postMessage(retObject);
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
            this.closeWhereToLoadDiv();
        }
    }
    phraseNCCode(result) {
        if (result.toString().includes("<")) {
            this.chanal = Chanals.multi;
        }
        let selction = document.querySelector('input[name="programTypeSelection"]:checked');
        if (selction != null) {
            if (selction.id == "multi") {
                this.chanal = Chanals.multi;
            }
            else if (selction.id == "2") {
                this.chanal = Chanals.two;
            }
            else if (selction.id == "3") {
                this.chanal = Chanals.tree;
            }
            else {
                this.chanal = Chanals.one;
            }
        }
        if (this.chanal == Chanals.multi) {
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
        else if (this.chanal == Chanals.two) {
            return Array.of("", result.toString());
        }
        else if (this.chanal == Chanals.tree) {
            return Array.of("", "", result.toString());
        }
        else {
            return Array.of(result.toString());
        }
    }
    closeWhereToLoadDiv() {
        if (this.parentDiv.contains(this.loadFileDiv)) {
            this.parentDiv.removeChild(this.loadFileDiv);
        }
    }
    createWhereToLoadDiv(result) {
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
    createSaveDiv() {
        if (this.parentDiv.contains(this.SaveFileDiv)) {
            this.parentDiv.removeChild(this.SaveFileDiv);
        }
        this.SaveFileDiv = document.createElement('div');
        this.SaveFileDiv.classList.add("fileLoadSelector");
        let loadFileButton = document.createElement('button');
        loadFileButton.addEventListener('click', () => this.saveText(this.editor));
        loadFileButton.textContent = "Save File";
        loadFileButton.style.backgroundColor = "green";
        let ProgramTypeSelection = document.createElement('form');
        let names = ['1', '2', '3', 'ALL \\ multi'];
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
        this.SaveFileDiv.appendChild(loadFileButton);
        this.SaveFileDiv.appendChild(ProgramTypeSelection);
        this.parentDiv.appendChild(this.SaveFileDiv);
    }
}

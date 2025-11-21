"use strict";

import { Observable } from "../technicalService/observer.js";
import "../technicalService/ace/ace.js"
import "../technicalService/ace/ext-language_tools.js"
import "../technicalService/ace/ext-settings_menu.js"
import "../technicalService/ace/mode-fanucnc.js"
import "../technicalService/ace/ext-searchbox.js"

function LoadScript(url) {
    var script = document.createElement("script"); 
    script.src = url;    
    document.head.appendChild(script);  }

export class Canal extends Observable {
    constructor(id, view3d, parentdiv,readOnly,timeLine) {
           super();
        this._textAreaCode =  document.createElement('div');
        this._parentDiv = parentdiv;
        parentdiv.classList.add("textareaCanal");        
        this._textAreaLineNumber = document.createElement('textarea');
        this._textAreaTimeLine = document.createElement('textarea');
        this._id = id
        this._view3d = view3d
        this._keyElementList = []
        this._textAreaCode.style.width = '100%'
        this._textAreaCode.style.height = '100%'
        this._textAreaCode.id = "editor_pro" + id;
        this._editor = ace.edit();
        this._editor.setShowPrintMargin(false);
    
        this._editor.renderer.setShowLineTimeLine(timeLine); 
        this._editor.setReadOnly(readOnly)
        require('ace/ext/settings_menu').init(this._editor);
        
        this._editor.getSession().setMode("ace/mode/fanucnc");
        ;
        this._editor.execCommand('find');
        //editor.searchBox.show();
        this._editor.searchBox.hide();
        var editor = this._editor;
        var tCanal 

        // Tool bar 
        var refs = {};
        function updateToolbar() {
            refs.saveButton.disabled = editor.session.getUndoManager().isClean();
            refs.undoButton.disabled = !editor.session.getUndoManager().hasUndo();
            refs.redoButton.disabled = !editor.session.getUndoManager().hasRedo();
        }
/*
        require('ace/lib/dom').buildDom(["div", { class: "toolbar" },
            ["button", {
                ref: "undoButton",
                onclick: function() {
                  editor.undo();
                }
            }, "undo"],
            ["button", {
                ref: "redoButton",
                onclick: function() {
                    editor.redo();
                }
            }, "redo"],
        ], this._parentDiv, refs);
    

        this._editor.setOptions({
                theme: "ace/theme/xcode",
                mode: "ace/mode/abc",
                minLines: 2,
                autoScrollEditorIntoView: true,
            });
        this._editor.commands.addCommands([{
                name: "showSettingsMenu",
                bindKey: {win:"change"trl-q", mac: "Ctrl-q"},
                exec: function(editor) {
                    editor.showSettingsMenu();
                },
                readOnly: true
            }]);
*/
            
        this._textAreaCode.appendChild(editor.container)
        parentdiv.appendChild(this._textAreaCode);

        this._editor.resize(true)

        var canal = this    
        let f = function(){
                canal._keyElementList = canal.parseKeyWords(editor.getValue().split(("\n")));
                canal.updated();
                canal.sessionStorageSetText(editor.getValue());
                // Mark as having uncommitted changes when editor content changes
                if (typeof window !== 'undefined') {
                    window.hasUncommittedChanges = true;
                }
            }
            this._editor.session.on('change',f);

            let cursorPositionChanged = function(){                
                canal.plotSingleLine(editor.getCursorPosition().row);
            }
        this._editor.on('changeSelection',cursorPositionChanged), 


        this._plotLines = [];
        this._bindSyncScrollLeftFunctions = []
        this._bindSyncScrollTopFunctions = []
        this._editor.resize(true)

    }



    removeSpace() {
        this._editor.find('( )(?:(?=(?:(?![\)}]).)*[\({])|(?!.*[\)}]))',{
            backwards: false,
            wrap: false,
            caseSensitive: false,
            wholeWord: false,
            regExp: true,
            start: 0
        });
        this._editor.replaceAll('');
        
        this._editor.moveCursorTo(0,0)
    }
    addSpace() {
        this.addSpacesInAce();
        this._editor.moveCursorTo(0,0)
    }
    redo() {
        this._editor.redo();
    }
    undo() {
        this._editor.undo();
    }

    openSearchBox() {
        this._editor.searchBox.show();
    }

    
    clearText(){
        this.setText(" ")
        this.sessionStorageSetText(" ")
    }
        
    bindScrollTop(slaveEditor) {
        let aceSession1 = this._editor.session;
        let aceSession2 = slaveEditor._editor.session;
        let f = function(){
            aceSession2.setScrollTop(aceSession1.getScrollTop())
        }
        aceSession1.on('changeScrollTop',f), 
        this._bindSyncScrollTopFunctions.push(f)
    }
    bindScrollLeft(slaveEditor) {
        let aceSession1 = this._editor.session;
        let aceSession2 = slaveEditor._editor.session;
        let f = function(){
            aceSession2.setScrollLeft(aceSession1.getScrollLeft())
        }
        aceSession1.on('changeScrollLeft',f), 
        this._bindSyncScrollLeftFunctions.push(f)
    }

    unbindAllSyncScrollTop() {
        for (let callback of this._bindSyncScrollTopFunctions){
            this._editor.session.removeEventListener('changeScrollTop', callback)
            
        }    
    }

    unbindAllSyncScrollLeft() {
        for (let callback of this._bindSyncScrollLeftFunctions){
            this._editor.session.removeEventListener('changeScrollLeft', callback)
        }    
    }
    
    addSpacesInAce(){
        this.insertSpaceAtSymbole('G')
        this.insertSpaceAtSymbole('A')
        this.insertSpaceAtSymbole('B')
        this.insertSpaceAtSymbole('C')
        this.insertSpaceAtSymbole('X')
        this.insertSpaceAtSymbole('Y')
        this.insertSpaceAtSymbole('Z')
        this.insertSpaceAtSymbole('H')
        this.insertSpaceAtSymbole(',R')
        this.insertSpaceAtSymbole('I')
        this.insertSpaceAtSymbole('J')
        this.insertSpaceAtSymbole('K')
        this.insertSpaceAtSymbole('F')
        this.insertSpaceAtSymbole('R')
        this.insertSpaceAtSymbole('S')
        this.insertSpaceAtSymbole('T')
        this.insertSpaceAtSymbole('U')
        this.insertSpaceAtSymbole('V')
        this.insertSpaceAtSymbole('W')
        this.insertSpaceAtSymbole('M')
        this.insertSpaceAtSymbole('P')

    }

    insertSpaceAtSymbole(symbol){
        this._editor.moveCursorTo(0,0)
        while(this._editor.find('((?<=[0-9\.])(?='+symbol+'[0-9\#]))',{
            backwards: false,
            wrap: true,
            caseSensitive: false,
            wholeWord: false,
            regExp: true,
            start: 0
        })){
        this._editor.insert(" ")
        }
    }
    
    getLength() {
        return this._editor.session.getLength();
    }
    getText() {
        return this._editor.session.getValue();
    }

    setText(value) {
        this._editor.setValue(value);
        this._editor.resize(true)
        
    }

    getTimeLine() {
        return this._editor.session.getValue();
    }

    setTimeLine(valueList) {
        this._editor.session.setTimeValue(valueList);
    }

    setHight(value){

        this._textAreaCode.style.height = value + "pt";
        this._editor.resize(true)
    }
    getHight(){
        return this._textAreaCode.style.height
    }

    getWidth(){
        return this._textAreaCode.style.width
    }
    setWidth(value){
        this._textAreaCode.style.width = value + "pt";
        this._editor.resize()
    }

    setValue(text){
        this._editor.setValue(text)
        this.updated();
    }
    getValue(){
        return this._editor.getValue()
    }

    plotSingleLine(index) {
        if (index < this._plotLines.length  && index >= 0) {
            this._view3d.plotSingle(this._plotLines[index]);
        }
    }
    plotNextLine() {
        let text = this._editor.getValue().split(("\n"));
        if (text.length > this._plotPosition + 1) {
            this._plotPosition += 0;
            let cursor = 0;
            let cursorEnd = 0;
            for (let i = 0; i <= this._plotPosition; i++) {
                cursor = cursorEnd;
                cursorEnd += text[i].length + 1;
            }
            this._textAreaCode.setSelectionRange(cursor, cursorEnd);
        }
    }
    plotPreveousLine() {
        let text = this._editor.getValue().split(("\n"));
        if (text.length > this._plotPosition && this._plotPosition > 1) {
            this._plotPosition -= 2;
            let cursor = 0;
            let cursorEnd = 0;
            for (let i = 0; i <= this._plotPosition; i++) {
                cursor = cursorEnd;
                cursorEnd += text[i].length + 1;
            }
            this._textAreaCode.setSelectionRange(cursor, cursorEnd);
        }
    }
    extractKeyNumber(programLine, key) {
        let number = NaN;
        programLine.replaceAll(" ", "");
        if (programLine.match(new RegExp(".*" + key + ".*"))) {
            programLine = programLine + " ";
            let regexEx = new RegExp("(?=" + key + ")");
            let lineKeyWords = programLine.split(regexEx);
            for (let keyWord of lineKeyWords) {
                if (keyWord.startsWith(key)) {
                    number = Number(keyWord.substring(1, keyWord.slice(1).search(/[A-Z\s]/) + 1));
                }
            }
        }
        return number;
    }
    createKeyWordLabel(keyword, lineIndex, cursorIndex) {
        let waitLabel = document.createElement('label');
        waitLabel.style.textAlign = "top";
        waitLabel.textContent = keyword;
        waitLabel.id = String(lineIndex) + "_" + String(cursorIndex);
        waitLabel.addEventListener("click", (label) => {
            if (label.currentTarget instanceof HTMLLabelElement) {
                let position = label.currentTarget.id.split("_");
                this._editor.scrollToLine(lineIndex)
                this._editor.moveCursorTo(lineIndex)
                this._editor.gotoLine(lineIndex)
                this._editor.moveCursorTo(lineIndex)

  
            }
        });
        return waitLabel;
    }
    parseKeyWords(ProgramLines) {
        let keyWordsList = [];
        let lineIndex = 0;
        let cursorIndex = 0;
        for (let programLine of ProgramLines) {
            let programLineComentsLeft = programLine.replaceAll(/\(.*\)/g, "");
            if (programLineComentsLeft.match(".*M.*")) {
                let number = this.extractKeyNumber(programLineComentsLeft, "M");
                if ((number > 199 && number < 999) || number == 133 || number == 131 || number == 83 || number == 82)
                    keyWordsList.push(this.createKeyWordLabel("M" + number, lineIndex, cursorIndex));
            }
            if (programLineComentsLeft.match(".*T.*")) {
                let number = this.extractKeyNumber(programLineComentsLeft, "T");
                if ((number > 99 && number < 9999))
                    keyWordsList.push(this.createKeyWordLabel("T" + number, lineIndex, cursorIndex));
            }
            cursorIndex += programLine.length + 1;
            lineIndex += 1;
        }
        return keyWordsList;
    }
    restoreText() {
        this.setText(this.sessionStorageGetText());
        this._editor.resize(true)
        this.timeLineVisible(true)
        this.timeLineVisible(false)

    }
    sessionStorageGetText() {
        let text = sessionStorage.getItem("text" + this.id.toString());
        if (text == null) {
            text = "";
        }
        return text;
    }
    sessionStorageSetText(text) {
        sessionStorage.setItem("text" + this.id.toString(), text);
    }
    getLineNumberFromText(countOfLines) {
        let text = "";
        for (let i = 1; i <= countOfLines; i++) {
            text = text + i + "\n";
        }
        return text;
    }
    
    resetPlotPosition() {
        this._plotPosition = 0;
    }
    

    timeLineVisible(value ){
        if (value === true){
            this._editor.renderer.setShowLineTimeLine(true); 
        }else{
            this._editor.renderer.setShowLineTimeLine(false); 
        }
    }


    countLines(text) {
        let linesArray = text.split('\n');
        return linesArray.length;
    }
    get textAreaCode() {
        return;
    }
    get textAreaLineNumber() {
        return this._textAreaLineNumber;
    }
    get timeLine() {
        return this._textAreaTimeLine;
    }
    get keyElementList() {
        return this._keyElementList;
    }
    get plotLines() {
        return this._keyElementList;
    }
    set plotLines(nplotLines) {
        this._plotLines = [];
        for (let line of nplotLines) {
            this._plotLines.push(line);
        }
    }
    get id() {
        return this._id;
    }
    destroyCanal(){
        this._editor.remove()
        this._textAreaCode.remove()
        this._textAreaLineNumber.remove()
        this._textAreaTimeLine.remove();
        this._parentDiv.remove()
    }
}

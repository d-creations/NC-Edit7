/**
 * autor : roth 
 * date : 2023
 * 
 * Canal class adapter 
 */

import { Observable } from "../technicalService/observer.js";
import {Canal} from "./canal.js";


export class CanalAdapter extends Observable {
    private _canal : Canal
    constructor(id: number,view3d: any, parentDiv : HTMLDivElement, canalCreatFunction : Function, readOnly : boolean, timeLine : boolean ) {
        super();
        this._canal = canalCreatFunction(id,view3d, parentDiv,readOnly,timeLine)

    }

    
    resetPlotPosition(): void {
        
    }


    removeSpace() {
        this._canal.removeSpace()
    }
    addSpace() {
        this._canal.addSpace()
    }
    redo() {
        this._canal.redo()
    }
    undo() {
        this._canal.undo()
    }
    openSearchBox(){
        this._canal.openSearchBox()
    }
    timeLineVisible(value : Boolean){
        this._canal.timeLineVisible(value)
    }
    bindScrollTop(canal : CanalAdapter) {
        this._canal.bindScrollTop(canal._canal)
    }
    bindScrollLeft(canal: CanalAdapter) {
        this._canal.bindScrollLeft(canal._canal)
    }

    unbindAllSyncScrollTop() {
        this._canal.unbindAllSyncScrollTop()
    }

    unbindAllSyncScrollLeft() {
        this._canal.unbindAllSyncScrollLeft()
    }

    
    public restoreText() {
        this._canal.restoreText()       
    }


    public clearText(){
        this._canal.clearText()
    }

    addObserver(observer) {
        this._canal.addObserver(observer);
    }
    updated() {
            this._canal.observer.updated();
        
    }
    

    get textAreaCode(): HTMLTextAreaElement {
        return this._canal._textAreaCode;
    }

    get text(): string {
        return this._canal.getText();
    }

    set text(value) {
        this._canal.setText(value);
    }

    get timeLine(): string {
        return this._canal.getTimeLine();
    }

    set timeLine(valueList : any[]) {
        this._canal.setTimeLine(valueList);
    }

    get textAreaLineNumber(): HTMLTextAreaElement {
        return this._canal._textAreaLineNumber;
    }
    get keyElementList(): HTMLLabelElement[] {
        return this._canal._keyElementList
    }
    get plotLines() {
        return this._canal._plotLines
    }

    set plotLines(nplotLines) {
        this._canal.plotLines = nplotLines
    }
    get id(): number {
        return this._canal.id;
    }
    getLength() {
        return this._canal.getLength();
    }
}
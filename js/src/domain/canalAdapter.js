import { Observable } from "../technicalService/observer.js";
export class CanalAdapter extends Observable {
    constructor(id, view3d, parentDiv, canalCreatFunction, readOnly, timeLine) {
        super();
        this._canal = canalCreatFunction(id, view3d, parentDiv, readOnly, timeLine);
    }
    resetPlotPosition() {
    }
    removeSpace() {
        this._canal.removeSpace();
    }
    addSpace() {
        this._canal.addSpace();
    }
    redo() {
        this._canal.redo();
    }
    undo() {
        this._canal.undo();
    }
    openSearchBox() {
        this._canal.openSearchBox();
    }
    timeLineVisible(value) {
        this._canal.timeLineVisible(value);
    }
    bindScrollTop(canal) {
        this._canal.bindScrollTop(canal._canal);
    }
    bindScrollLeft(canal) {
        this._canal.bindScrollLeft(canal._canal);
    }
    unbindAllSyncScrollTop() {
        this._canal.unbindAllSyncScrollTop();
    }
    unbindAllSyncScrollLeft() {
        this._canal.unbindAllSyncScrollLeft();
    }
    restoreText() {
        this._canal.restoreText();
    }
    clearText() {
        this._canal.clearText();
    }
    addObserver(observer) {
        this._canal.addObserver(observer);
    }
    updated() {
        this._canal.observer.updated();
    }
    get textAreaCode() {
        return this._canal._textAreaCode;
    }
    get text() {
        return this._canal.getText();
    }
    set text(value) {
        this._canal.setText(value);
    }
    get timeLine() {
        return this._canal.getTimeLine();
    }
    set timeLine(valueList) {
        this._canal.setTimeLine(valueList);
    }
    get textAreaLineNumber() {
        return this._canal._textAreaLineNumber;
    }
    get keyElementList() {
        return this._canal._keyElementList;
    }
    get plotLines() {
        return this._canal._plotLines;
    }
    set plotLines(nplotLines) {
        this._canal.plotLines = nplotLines;
    }
    get id() {
        return this._canal.id;
    }
    getLength() {
        return this._canal.getLength();
    }
}

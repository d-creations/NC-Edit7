export class Observable {
    constructor() {
        this.obervers = [];
    }
    addObserver(observer) {
        this.obervers.push(observer);
    }
    updated() {
        for (let observer of this.obervers) {
            observer.OberverUpdate();
        }
    }
}

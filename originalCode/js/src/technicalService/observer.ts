export interface Observer{
     OberverUpdate() : void
}

export class Observable{
    private obervers: Array<Observer>

    constructor(){
        this.obervers = []
    }
    
    public addObserver( observer : Observer) {
    this.obervers.push(observer);
    }  

    protected updated(){
        for(let observer of this.obervers){
            observer.OberverUpdate()
        }
    }

}
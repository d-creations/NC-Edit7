

export class UserError{

    parentDiv : HTMLDivElement

    constructor(parentDiv : HTMLDivElement) {
        this.parentDiv = parentDiv
    }

    public printMessage(message: string) {
        if (this.parentDiv instanceof HTMLDivElement){
            this.parentDiv.innerHTML = message.replaceAll("\n",'<br>');
        }else{
            console.log("error proint")
        }
    }
}


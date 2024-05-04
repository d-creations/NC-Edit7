export class UserError {
    constructor(parentDiv) {
        this.parentDiv = parentDiv;
    }
    printMessage(message) {
        if (this.parentDiv instanceof HTMLDivElement) {
            this.parentDiv.innerHTML = message.replaceAll("\n", '<br>');
        }
        else {
            console.log("error proint");
        }
    }
}

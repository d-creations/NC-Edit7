

export class UserError{

    constructor() {
    }

    public printMessage(message: string) {
        let errorMessage =  document.getElementById("errorLabel");
        if (errorMessage instanceof HTMLParagraphElement){
            errorMessage.innerHTML = message.replaceAll("\n",'<br>');
        }else{
            console.log("error proint")
        }
    }
}



export class FileNotFoundUserError extends UserError{
    constructor() {
        super()
        this.printMessage(" File not Found");
    }

}
export class ExampleCreator {
    constructor() {
        return;
    }
    getExample(canalNumbers, editor) {
        let ret = [""];
        let xHttp = new XMLHttpRequest();
        xHttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                var o = this.responseText;
                for (let canalNumber = 0; canalNumber < canalNumbers; canalNumber++) {
                    let text = o.toString();
                    text = text.replace(/<.*>\n/g, "");
                    let programms = text.split("PPPPP");
                    editor.canals[canalNumber].text = programms[canalNumber];
                }
            }
        };
        switch (canalNumbers) {
            case 3:
                xHttp.open("GET", ".\\res\\O0003", true);
                break;
            case 2:
                xHttp.open("GET", ".\\res\\O0002", true);
                break;
            default:
                xHttp.open("GET", ".\\res\\O0001", true);
                break;
        }
        xHttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        xHttp.send();
        return ret;
    }
}

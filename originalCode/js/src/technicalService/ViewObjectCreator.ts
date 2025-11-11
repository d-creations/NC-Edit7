


export class ViewObjectCreator{
    static createInputButton(parentDiv: HTMLDivElement, url: string) {
        let input_button = document.createElement('input');
        input_button.type = "image"
        input_button.src = url
        input_button.alt = "button";
        input_button.classList.add("PlayButton");
       parentDiv.appendChild(input_button);
       return input_button;
    }


    public static createTabButton(parentDiv: HTMLDivElement,text : string) : HTMLButtonElement{
        let button = document.createElement('button');
        button.name = text;
        button.innerText = text;
        parentDiv.appendChild(button);
        return button;
    }

    public static create3DViewTabButton(parentDiv: HTMLDivElement,text : string) : HTMLButtonElement{
        let button = document.createElement('button');
        button.name = text;
        button.innerText = text;
        button.classList.add("D3ViewTabButton")
        parentDiv.appendChild(button);
        return button;
    }
    


    public static createMultiViewSelector(parentDiv: HTMLDivElement) {
        let MulitcheckedBox = document.createElement('input');
        MulitcheckedBox.type = "checkbox";
        MulitcheckedBox.name = "MultiView";
        MulitcheckedBox.id = "MultiView";

        let mulitcheckedLabel = document.createElement('label');
        let mulitcheckedBaseLabel = document.createElement('label');
        mulitcheckedBaseLabel.classList.add("switch")
        mulitcheckedLabel.classList.add("labelS")
        let multicheckedspand = document.createElement('span');
        multicheckedspand.classList.add("slider","round")
        mulitcheckedLabel.htmlFor = "MultiView";
        mulitcheckedLabel.innerHTML = "MultiView";
        mulitcheckedBaseLabel.appendChild(MulitcheckedBox)
        mulitcheckedBaseLabel.appendChild(multicheckedspand);
        parentDiv.appendChild(mulitcheckedLabel);
        parentDiv.appendChild(mulitcheckedBaseLabel);
        return MulitcheckedBox;
    }

    


    public static createTimeViewSelector(parentDiv: HTMLDivElement) {
        let MulitcheckedBox = document.createElement('input');
        MulitcheckedBox.type = "checkbox";
        MulitcheckedBox.name = "time";
        MulitcheckedBox.id = "time";
        let mulitcheckedLabel = document.createElement('img');
        let mulitcheckedBaseLabel = document.createElement('label');
        mulitcheckedBaseLabel.classList.add("switch")
        mulitcheckedLabel.classList.add("menuImage")
        let multicheckedspand = document.createElement('span');
        multicheckedspand.classList.add("slider","round")
        mulitcheckedLabel.src = "./image/time.png";
        mulitcheckedLabel.alt = " \u2002time";
        mulitcheckedBaseLabel.appendChild(MulitcheckedBox)
        mulitcheckedBaseLabel.appendChild(multicheckedspand);
        parentDiv.appendChild(mulitcheckedLabel);
        parentDiv.appendChild(mulitcheckedBaseLabel);

        return MulitcheckedBox;
    }

    

    public static createMachineSelector(parentDiv: HTMLDivElement, controlList : string[]) : HTMLSelectElement {
        let machineSelection = document.createElement('select');

        for (let key in controlList) {
            let opt = document.createElement('option');
            opt.value = controlList[key];
            opt.innerHTML = controlList[key];
            ;
            machineSelection.appendChild(opt);
        }
        parentDiv.appendChild(machineSelection)
        return machineSelection;
    }

    
    public static createMachineSelectorS(parentDiv: HTMLDivElement, controlList : string[]) : HTMLSelectElement {
        let machineSelection = document.createElement('select');

        for (let key in controlList) {
            let opt = document.createElement('option');
            opt.value = controlList[key];
            opt.innerHTML = controlList[key];
            ;
            machineSelection.appendChild(opt);
        }
        parentDiv.appendChild(machineSelection)
        machineSelection.style.padding = "0pt";
        machineSelection.style.margin = "0pt";
        return machineSelection;
    }



    public static createPlotButton(parentDiv: HTMLDivElement) : HTMLButtonElement{
        let button = document.createElement('button');
        button.name = "plot_Canal1";
        button.innerText = "plot-all";
        button.classList.add("button")

        parentDiv.appendChild(button);
        return button;
    }

    public static createExampleButton(parentDiv: HTMLDivElement) : HTMLButtonElement{
        let button = document.createElement('button');
        button.classList.add("button")
        button.name = "example";
        button.innerText = "example";
        parentDiv.appendChild(button);
        return button;
    }


    public static createPlayButton(parentDiv: HTMLElement): HTMLInputElement {
        let input_button = document.createElement('input');
        input_button.type = "image"
        input_button.src = "./image/play.png"
        input_button.alt = "1";
        input_button.classList.add("PlayButton");
       parentDiv.appendChild(input_button);
       return input_button;
    }

    public static createClearButton(parentDiv: HTMLDivElement) : HTMLInputElement {
        let input_button = document.createElement('input');
        input_button.type = "image"
        input_button.src = "./image/trash.png"
        input_button.alt = "Trash";        
        input_button.width = 20;
        input_button.height = 20;
        input_button.classList.add("MenuButton")
       parentDiv.appendChild(input_button);
       return input_button
    }

    public static createCountCanalButtons(parentDiv: HTMLDivElement) {
        let canalCountSelection = document.createElement('select');


        let canalsCounter = [1,2,3]
        for (let key of canalsCounter) {
            let opt = document.createElement('option');
            opt.value = String(key);
            opt.innerHTML = String(key);
            ;
            canalCountSelection.appendChild(opt);
        }
        parentDiv.appendChild(canalCountSelection);
        return canalCountSelection;
    }

    public static createLabel(htmlElement: HTMLElement, key: string) {
        let label = document.createElement("label");
        label.textContent = key;
        htmlElement.appendChild(label)
        return label
    }

    public static createLableInCell(tableRowName: HTMLTableRowElement, key: string) {
        let canalC = tableRowName.insertCell();
        let label = document.createElement("label");
        label.textContent = key;
        canalC.appendChild(label)
    }

    
    public static createViewSelector(parentDiv: HTMLDivElement , viewList : string[]): HTMLElement | null {
        let machineSelection = document.getElementById('selectView');
        if (machineSelection instanceof HTMLSelectElement){ 
        for (let key in viewList) {
            let opt = document.createElement('option');
            opt.value = viewList[key];
            opt.innerHTML = viewList[key];
            ;
            machineSelection.appendChild(opt);
            }
        } 
        return machineSelection;
    }


}
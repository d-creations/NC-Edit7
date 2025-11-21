import { ViewObjectCreator } from "../technicalService/ViewObjectCreator.js";

export class TabContent {
    TabTitle: string;
    TabBody: HTMLDivElement;

    constructor(TabTitle: string, TabBody: HTMLDivElement) {
        this.TabTitle = TabTitle;
        this.TabBody = TabBody;
    }
}

export class TabManager {
    parentDiv: HTMLDivElement;
    TabHeaderDiv: HTMLDivElement;
    TabBodyDiv: HTMLDivElement;

    constructor(parentDiv: HTMLDivElement) {
        this.parentDiv = parentDiv;
        this.TabHeaderDiv = document.createElement("div");
        this.TabBodyDiv = document.createElement("div");
        parentDiv.appendChild(this.TabHeaderDiv);
        parentDiv.appendChild(this.TabBodyDiv);
        this.TabBodyDiv.classList.add("D3ViewTabBody");
        this.TabHeaderDiv.classList.add("D3ViewTabHead");
 
    }


    addTab(tabContent: TabContent) {
        let tabHeader = ViewObjectCreator.create3DViewTabButton(this.TabHeaderDiv, tabContent.TabTitle);
        console.log(tabContent.TabTitle);
        tabHeader.onclick = () => {
            this.TabBodyDiv.innerHTML = "";
            this.TabBodyDiv.appendChild(tabContent.TabBody);
            this.deactivateAllTabs();
            tabHeader.classList.remove("D3ViewTabButtonInactive");
            tabHeader.classList.add("D3ViewTabButtonActive");
        };
        this.deactivateAllTabs();
        tabHeader.classList.remove("D3ViewTabButtonInactive");
        tabHeader.classList.add("D3ViewTabButtonActive");
        this.TabBodyDiv.innerHTML = "";
        this.TabBodyDiv.appendChild(tabContent.TabBody);
    }

    private deactivateAllTabs() {
        for (let i = 0; i < this.TabHeaderDiv.children.length; i++) {
            let child = this.TabHeaderDiv.children[i];
            child.classList.remove("D3ViewTabButtonActive");
            child.classList.add("D3ViewTabButtonInactive");
        }
    }

}
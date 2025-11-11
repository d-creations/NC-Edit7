import { ViewObjectCreator } from "../technicalService/ViewObjectCreator.js";
export class TabContent {
    constructor(TabTitle, TabBody) {
        this.TabTitle = TabTitle;
        this.TabBody = TabBody;
    }
}
export class TabManager {
    constructor(parentDiv) {
        this.parentDiv = parentDiv;
        this.TabHeaderDiv = document.createElement("div");
        this.TabBodyDiv = document.createElement("div");
        parentDiv.appendChild(this.TabHeaderDiv);
        parentDiv.appendChild(this.TabBodyDiv);
        this.TabBodyDiv.classList.add("D3ViewTabBody");
        this.TabHeaderDiv.classList.add("D3ViewTabHead");
    }
    addTab(tabContent) {
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
    deactivateAllTabs() {
        for (let i = 0; i < this.TabHeaderDiv.children.length; i++) {
            let child = this.TabHeaderDiv.children[i];
            child.classList.remove("D3ViewTabButtonActive");
            child.classList.add("D3ViewTabButtonInactive");
        }
    }
}

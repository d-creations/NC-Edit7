import "./channel-panel.js";
import "./nc-code-pane.js";
import "./nc-tool-list.js";
import "./nc-variable-list.js";
import "./nc-executed-list.js";
export declare class NcEditorApp extends HTMLElement {
    private subscriptions;
    private parseButton?;
    private programInput?;
    private statusLabel?;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    private handleParse;
    private renderChannelState;
    private updateChannelPanels;
    private dispatchInitialParse;
}
//# sourceMappingURL=nc-editor-app.d.ts.map
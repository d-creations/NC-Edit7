export declare class NcCodePane extends HTMLElement {
    static get observedAttributes(): string[];
    private channelId;
    private subscription?;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void;
    private render;
}
//# sourceMappingURL=nc-code-pane.d.ts.map
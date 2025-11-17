type ChannelViewError = {
    lineNumber: number;
    message: string;
};
type ChannelViewState = {
    channelId: string;
    errors: ChannelViewError[];
    timeline: number[];
    parseResult?: {
        summary: {
            lineCount: number;
            parsedAt: number;
        };
        toolUsage: {
            toolNumber: number;
        }[];
    };
    lastUpdated: number;
};
export declare class NcChannelPanel extends HTMLElement {
    private _state?;
    constructor();
    set channelState(state: ChannelViewState | undefined);
    get channelState(): ChannelViewState | undefined;
    private formatErrors;
    private render;
}
export type { ChannelViewState };
//# sourceMappingURL=channel-panel.d.ts.map
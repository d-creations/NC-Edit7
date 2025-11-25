import type { ChannelState } from "../domain/models.js";
export declare class NcChannelPanel extends HTMLElement {
    private _state?;
    constructor();
    set channelState(state: ChannelState | undefined);
    get channelState(): ChannelState | undefined;
    private formatErrors;
    private render;
}
//# sourceMappingURL=channel-panel.d.ts.map
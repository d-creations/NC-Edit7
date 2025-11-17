import type { ChannelState } from "../domain/models.js";
export declare class NcToolList extends HTMLElement {
    private _state?;
    constructor();
    set channelState(state: ChannelState | undefined);
    get channelState(): ChannelState | undefined;
    private render;
}
//# sourceMappingURL=nc-tool-list.d.ts.map
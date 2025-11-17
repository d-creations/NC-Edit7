import type { ChannelState } from "../domain/models.js";
export declare class NcExecutedList extends HTMLElement {
    private _state?;
    constructor();
    set channelState(state: ChannelState | undefined);
    get channelState(): ChannelState | undefined;
    private render;
}
//# sourceMappingURL=nc-executed-list.d.ts.map
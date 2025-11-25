import type { ChannelState } from "../domain/models.js";
export declare class NcVariableList extends HTMLElement {
    private _state?;
    constructor();
    set channelState(state: ChannelState | undefined);
    get channelState(): ChannelState | undefined;
    private extractVariables;
    private render;
}
//# sourceMappingURL=nc-variable-list.d.ts.map
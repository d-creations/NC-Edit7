import { EventBus } from "../../core/eventBus.js";
import { ParserService, ParserEvents } from "../parser/parserService.js";
import { ChannelId, ChannelState } from "../../domain/models.js";
export interface StateEvents extends Record<string, unknown> {
    channelUpdated: {
        state: ChannelState;
    };
}
export declare class StateService<Events extends ParserEvents & StateEvents> {
    private readonly parser;
    private readonly eventBus;
    private readonly channelStates;
    constructor(parser: ParserService<Events>, eventBus: EventBus<Events>);
    setChannelProgram(channelId: ChannelId, program: string): ChannelState;
    getChannelState(channelId: ChannelId): ChannelState | undefined;
    private buildTimeline;
}
//# sourceMappingURL=stateService.d.ts.map
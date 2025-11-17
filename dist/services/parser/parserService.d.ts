import { EventBus } from "../../core/eventBus.js";
import { ChannelId, NcParseResult } from "../../domain/models.js";
export interface ParserEvents extends Record<string, unknown> {
    parseCompleted: {
        channelId: ChannelId;
        result: NcParseResult;
    };
    parseFailed: {
        channelId: ChannelId;
        error: Error;
    };
}
export declare class ParserService<Events extends ParserEvents> {
    private readonly eventBus;
    constructor(eventBus: EventBus<Events>);
    parse(channelId: ChannelId, programText: string): NcParseResult;
    private stripComments;
    private tokenize;
}
//# sourceMappingURL=parserService.d.ts.map
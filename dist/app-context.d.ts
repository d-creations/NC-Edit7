import { EventBus } from "./core/eventBus.js";
import { ParserService, ParserEvents } from "./services/parser/parserService.js";
import { StateService, StateEvents } from "./services/state/stateService.js";
import { ChannelId } from "./domain/models.js";
export type AppEvents = ParserEvents & StateEvents;
export declare const eventBus: EventBus<AppEvents>;
export declare const parserService: ParserService<AppEvents>;
export declare const stateService: StateService<AppEvents>;
export declare function updateChannelProgram(channelId: ChannelId, program: string): import("./domain/models.js").ChannelState;
//# sourceMappingURL=app-context.d.ts.map
import { EventBus } from "./core/eventBus.js";
import { ParserService } from "./services/parser/parserService.js";
import { StateService } from "./services/state/stateService.js";
export const eventBus = new EventBus();
export const parserService = new ParserService(eventBus);
export const stateService = new StateService(parserService, eventBus);
export function updateChannelProgram(channelId, program) {
    return stateService.setChannelProgram(channelId, program);
}
//# sourceMappingURL=app-context.js.map
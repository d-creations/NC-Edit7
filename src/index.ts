import { EventBus } from "./core/eventBus.js";
import { ParserService, ParserEvents } from "./services/parser/parserService.js";
import { StateService, StateEvents } from "./services/state/stateService.js";
import { ChannelId } from "./domain/models.js";

export type AppEvents = ParserEvents & StateEvents;

const eventBus = new EventBus<AppEvents>();

export const parserService = new ParserService<AppEvents>(eventBus);
export const stateService = new StateService<AppEvents>(parserService, eventBus);

export function updateChannelProgram(channelId: ChannelId, program: string) {
  return stateService.setChannelProgram(channelId, program);
}

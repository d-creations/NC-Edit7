import { EventBus } from "../../core/eventBus.js";
import { ParserService, ParserEvents } from "../parser/parserService.js";
import { ChannelId, ChannelState } from "../../domain/models.js";

export interface StateEvents extends Record<string, unknown> {
  channelUpdated: { state: ChannelState };
}

export class StateService<Events extends ParserEvents & StateEvents> {
  private readonly channelStates = new Map<ChannelId, ChannelState>();

  constructor(
    private readonly parser: ParserService<Events>,
    private readonly eventBus: EventBus<Events>
  ) {}

  setChannelProgram(channelId: ChannelId, program: string): ChannelState {
    const now = Date.now();
    const result = this.parser.parse(channelId, program);

    const lineCount = result.summary.lineCount;
    const state: ChannelState = {
      channelId,
      program,
      parseResult: result,
      errors: result.errors,
      timeline: this.buildTimeline(lineCount),
      lastUpdated: now,
    };

    this.channelStates.set(channelId, state);
    this.eventBus.emit("channelUpdated", { state });
    return state;
  }

  getChannelState(channelId: ChannelId): ChannelState | undefined {
    return this.channelStates.get(channelId);
  }

  private buildTimeline(lineCount: number): number[] {
    return Array.from({ length: lineCount }, (_, index) => index + 1);
  }
}

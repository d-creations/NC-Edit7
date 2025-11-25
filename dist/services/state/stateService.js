export class StateService {
    constructor(parser, eventBus) {
        this.parser = parser;
        this.eventBus = eventBus;
        this.channelStates = new Map();
    }
    setChannelProgram(channelId, program) {
        const now = Date.now();
        const result = this.parser.parse(channelId, program);
        const lineCount = result.summary.lineCount;
        const state = {
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
    getChannelState(channelId) {
        return this.channelStates.get(channelId);
    }
    buildTimeline(lineCount) {
        return Array.from({ length: lineCount }, (_, index) => index + 1);
    }
}
//# sourceMappingURL=stateService.js.map
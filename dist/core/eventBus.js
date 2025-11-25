export class EventBus {
    constructor() {
        this.handlers = new Map();
    }
    on(event, handler) {
        const existing = this.handlers.get(event);
        if (existing) {
            existing.add(handler);
        }
        else {
            this.handlers.set(event, new Set([handler]));
        }
        return () => this.off(event, handler);
    }
    off(event, handler) {
        const existing = this.handlers.get(event);
        if (existing) {
            existing.delete(handler);
            if (existing.size === 0) {
                this.handlers.delete(event);
            }
        }
    }
    emit(event, payload) {
        const registry = this.handlers.get(event);
        if (!registry) {
            return;
        }
        for (const handler of Array.from(registry)) {
            handler(payload);
        }
    }
}
//# sourceMappingURL=eventBus.js.map
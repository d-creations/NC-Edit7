type EventHandler<Payload> = (payload: Payload) => void;
export declare class EventBus<Events extends Record<string, unknown>> {
    private handlers;
    on<Key extends keyof Events>(event: Key, handler: EventHandler<Events[Key]>): () => void;
    off<Key extends keyof Events>(event: Key, handler: EventHandler<Events[Key]>): void;
    emit<Key extends keyof Events>(event: Key, payload: Events[Key]): void;
}
export {};
//# sourceMappingURL=eventBus.d.ts.map
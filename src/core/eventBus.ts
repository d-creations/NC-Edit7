type EventHandler<Payload> = (payload: Payload) => void;

type HandlerRegistry<Events extends Record<string, unknown>> = Map<keyof Events, Set<EventHandler<Events[keyof Events]>>>;

/**
 * Simple event bus that provides strongly typed publish/subscribe semantics.
 */
export class EventBus<Events extends Record<string, unknown>> {
  private handlers: HandlerRegistry<Events> = new Map();

  on<Key extends keyof Events>(event: Key, handler: EventHandler<Events[Key]>): () => void {
    const existing = this.handlers.get(event);
    if (existing) {
      existing.add(handler as EventHandler<Events[keyof Events]>);
    } else {
      this.handlers.set(event, new Set([handler as EventHandler<Events[keyof Events]>]));
    }

    return () => this.off(event, handler);
  }

  off<Key extends keyof Events>(event: Key, handler: EventHandler<Events[Key]>): void {
    const existing = this.handlers.get(event);
    if (existing) {
      existing.delete(handler as EventHandler<Events[keyof Events]>);
      if (existing.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  emit<Key extends keyof Events>(event: Key, payload: Events[Key]): void {
    const registry = this.handlers.get(event);
    if (!registry) {
      return;
    }

    for (const handler of Array.from(registry)) {
      handler(payload);
    }
  }
}

/**
 * EventBus - Lightweight publish/subscribe for application-level events
 */

import type { AppEvent } from '@core/types';

type EventHandler<T extends AppEvent = AppEvent> = (event: T) => void;
type Unsubscribe = () => void;

/**
 * EventBus provides a simple pub/sub mechanism for application events
 */
export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private eventHistory: AppEvent[] = [];
  private readonly maxHistorySize = 100;

  /**
   * Subscribe to events of a specific type
   */
  on<T extends AppEvent>(eventType: string, handler: EventHandler<T>): Unsubscribe {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const handlers = this.handlers.get(eventType)!;
    handlers.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler as EventHandler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }

  /**
   * Subscribe to an event once, then automatically unsubscribe
   */
  once<T extends AppEvent>(eventType: string, handler: EventHandler<T>): Unsubscribe {
    const unsubscribe = this.on<T>(eventType, (event) => {
      unsubscribe();
      handler(event);
    });
    return unsubscribe;
  }

  /**
   * Emit an event to all subscribers
   */
  emit<T extends AppEvent>(event: T): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      // Create a copy to avoid issues if handlers modify the set during iteration
      const handlersCopy = Array.from(handlers);
      for (const handler of handlersCopy) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${event.type}:`, error);
        }
      }
    }

    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * Remove all handlers for a specific event type
   */
  off(eventType: string): void {
    this.handlers.delete(eventType);
  }

  /**
   * Remove all handlers
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Get the number of handlers for an event type
   */
  listenerCount(eventType: string): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }

  /**
   * Get all event types that have handlers
   */
  eventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get recent event history
   */
  getHistory(eventType?: string, limit?: number): AppEvent[] {
    let history = this.eventHistory;
    
    if (eventType) {
      history = history.filter((e) => e.type === eventType);
    }

    if (limit && limit > 0) {
      return history.slice(-limit);
    }

    return [...history];
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }
}

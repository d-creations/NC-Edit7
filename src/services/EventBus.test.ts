import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from './EventBus';
import type { AppEvent } from '@core/types';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('on', () => {
    it('should subscribe to events', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.on('test:event', handler);

      expect(typeof unsubscribe).toBe('function');
      expect(eventBus.listenerCount('test:event')).toBe(1);
    });

    it('should call handler when event is emitted', () => {
      const handler = vi.fn();
      eventBus.on('test:event', handler);

      const event: AppEvent = {
        type: 'test:event',
        timestamp: Date.now(),
        payload: { data: 'test' },
      };

      eventBus.emit(event);
      expect(handler).toHaveBeenCalledWith(event);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should allow multiple handlers for the same event type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('test:event', handler1);
      eventBus.on('test:event', handler2);

      const event: AppEvent = {
        type: 'test:event',
        timestamp: Date.now(),
        payload: {},
      };

      eventBus.emit(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
      expect(eventBus.listenerCount('test:event')).toBe(2);
    });

    it('should unsubscribe when calling returned function', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.on('test:event', handler);

      unsubscribe();

      expect(eventBus.listenerCount('test:event')).toBe(0);

      const event: AppEvent = {
        type: 'test:event',
        timestamp: Date.now(),
        payload: {},
      };

      eventBus.emit(event);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('once', () => {
    it('should subscribe and automatically unsubscribe after first event', () => {
      const handler = vi.fn();
      eventBus.once('test:event', handler);

      const event: AppEvent = {
        type: 'test:event',
        timestamp: Date.now(),
        payload: {},
      };

      eventBus.emit(event);
      expect(handler).toHaveBeenCalledTimes(1);

      eventBus.emit(event);
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should allow manual unsubscribe before event is emitted', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.once('test:event', handler);

      unsubscribe();

      const event: AppEvent = {
        type: 'test:event',
        timestamp: Date.now(),
        payload: {},
      };

      eventBus.emit(event);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('emit', () => {
    it('should handle errors in event handlers gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();

      eventBus.on('test:event', errorHandler);
      eventBus.on('test:event', normalHandler);

      const event: AppEvent = {
        type: 'test:event',
        timestamp: Date.now(),
        payload: {},
      };

      eventBus.emit(event);

      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should not emit to handlers of different event types', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('test:event1', handler1);
      eventBus.on('test:event2', handler2);

      const event: AppEvent = {
        type: 'test:event1',
        timestamp: Date.now(),
        payload: {},
      };

      eventBus.emit(event);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should store events in history', () => {
      const event1: AppEvent = {
        type: 'test:event',
        timestamp: Date.now(),
        payload: { id: 1 },
      };

      const event2: AppEvent = {
        type: 'test:event',
        timestamp: Date.now() + 1,
        payload: { id: 2 },
      };

      eventBus.emit(event1);
      eventBus.emit(event2);

      const history = eventBus.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual(event1);
      expect(history[1]).toEqual(event2);
    });
  });

  describe('off', () => {
    it('should remove all handlers for a specific event type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('test:event', handler1);
      eventBus.on('test:event', handler2);

      eventBus.off('test:event');

      expect(eventBus.listenerCount('test:event')).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all handlers for all events', () => {
      eventBus.on('test:event1', vi.fn());
      eventBus.on('test:event2', vi.fn());

      eventBus.clear();

      expect(eventBus.listenerCount('test:event1')).toBe(0);
      expect(eventBus.listenerCount('test:event2')).toBe(0);
      expect(eventBus.eventTypes()).toHaveLength(0);
    });
  });

  describe('listenerCount', () => {
    it('should return 0 for event types with no handlers', () => {
      expect(eventBus.listenerCount('nonexistent')).toBe(0);
    });

    it('should return correct count for registered handlers', () => {
      eventBus.on('test:event', vi.fn());
      eventBus.on('test:event', vi.fn());
      eventBus.on('test:event', vi.fn());

      expect(eventBus.listenerCount('test:event')).toBe(3);
    });
  });

  describe('eventTypes', () => {
    it('should return all registered event types', () => {
      eventBus.on('test:event1', vi.fn());
      eventBus.on('test:event2', vi.fn());

      const types = eventBus.eventTypes();
      expect(types).toContain('test:event1');
      expect(types).toContain('test:event2');
      expect(types).toHaveLength(2);
    });

    it('should return empty array when no events are registered', () => {
      expect(eventBus.eventTypes()).toHaveLength(0);
    });
  });

  describe('getHistory', () => {
    it('should return all events when no filters are applied', () => {
      const event1: AppEvent = {
        type: 'test:event1',
        timestamp: Date.now(),
        payload: {},
      };

      const event2: AppEvent = {
        type: 'test:event2',
        timestamp: Date.now(),
        payload: {},
      };

      eventBus.emit(event1);
      eventBus.emit(event2);

      const history = eventBus.getHistory();
      expect(history).toHaveLength(2);
    });

    it('should filter events by type', () => {
      const event1: AppEvent = {
        type: 'test:event1',
        timestamp: Date.now(),
        payload: {},
      };

      const event2: AppEvent = {
        type: 'test:event2',
        timestamp: Date.now(),
        payload: {},
      };

      eventBus.emit(event1);
      eventBus.emit(event2);
      eventBus.emit(event1);

      const history = eventBus.getHistory('test:event1');
      expect(history).toHaveLength(2);
      expect(history.every((e) => e.type === 'test:event1')).toBe(true);
    });

    it('should limit the number of returned events', () => {
      for (let i = 0; i < 5; i++) {
        eventBus.emit({
          type: 'test:event',
          timestamp: Date.now(),
          payload: { id: i },
        });
      }

      const history = eventBus.getHistory(undefined, 3);
      expect(history).toHaveLength(3);
      expect(history[0]?.payload).toEqual({ id: 2 });
      expect(history[2]?.payload).toEqual({ id: 4 });
    });
  });

  describe('clearHistory', () => {
    it('should clear event history', () => {
      eventBus.emit({
        type: 'test:event',
        timestamp: Date.now(),
        payload: {},
      });

      expect(eventBus.getHistory()).toHaveLength(1);

      eventBus.clearHistory();

      expect(eventBus.getHistory()).toHaveLength(0);
    });
  });
});

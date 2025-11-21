import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceRegistry, Disposable, Initializable } from './ServiceRegistry';

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  describe('register', () => {
    it('should register a service with a factory function', () => {
      const factory = () => ({ value: 42 });
      registry.register('test-service', factory);

      expect(registry.has('test-service')).toBe(true);
    });

    it('should throw error when registering duplicate service', () => {
      const factory = () => ({ value: 42 });
      registry.register('test-service', factory);

      expect(() => {
        registry.register('test-service', factory);
      }).toThrow('Service already registered: test-service');
    });

    it('should register as singleton by default', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { value: callCount };
      };

      registry.register('test-service', factory);

      const instance1 = registry.get('test-service');
      const instance2 = registry.get('test-service');

      expect(instance1).toBe(instance2);
      expect(callCount).toBe(1);
    });

    it('should create new instances when not singleton', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { value: callCount };
      };

      registry.register('test-service', factory, { singleton: false });

      const instance1 = registry.get<{ value: number }>('test-service');
      const instance2 = registry.get<{ value: number }>('test-service');

      expect(instance1).not.toBe(instance2);
      expect(instance1.value).toBe(1);
      expect(instance2.value).toBe(2);
      expect(callCount).toBe(2);
    });
  });

  describe('registerClass', () => {
    it('should register a service with a constructor', () => {
      class TestService {
        value = 42;
      }

      registry.registerClass('test-service', TestService);

      const instance = registry.get<TestService>('test-service');
      expect(instance).toBeInstanceOf(TestService);
      expect(instance.value).toBe(42);
    });

    it('should inject dependencies when creating instance', () => {
      class DependencyService {
        value = 10;
      }

      class TestService {
        constructor(public dep: DependencyService) {}
      }

      registry.registerClass('dependency', DependencyService);
      registry.registerClass('test-service', TestService, {
        dependencies: ['dependency'],
      });

      const instance = registry.get<TestService>('test-service');
      expect(instance.dep).toBeInstanceOf(DependencyService);
      expect(instance.dep.value).toBe(10);
    });
  });

  describe('get', () => {
    it('should throw error when service is not registered', () => {
      expect(() => {
        registry.get('nonexistent');
      }).toThrow('Service not registered: nonexistent');
    });

    it('should detect circular dependencies', () => {
      registry.register('service-a', () => registry.get('service-b'));
      registry.register('service-b', () => registry.get('service-a'));

      expect(() => {
        registry.get('service-a');
      }).toThrow('Circular dependency detected');
    });

    it('should return cached singleton instance', () => {
      const factory = vi.fn(() => ({ value: 42 }));
      registry.register('test-service', factory);

      registry.get('test-service');
      registry.get('test-service');

      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe('has', () => {
    it('should return true for registered services', () => {
      registry.register('test-service', () => ({}));
      expect(registry.has('test-service')).toBe(true);
    });

    it('should return false for unregistered services', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('tryGet', () => {
    it('should return service instance if registered', () => {
      registry.register('test-service', () => ({ value: 42 }));
      const instance = registry.tryGet<{ value: number }>('test-service');

      expect(instance).toBeDefined();
      expect(instance?.value).toBe(42);
    });

    it('should return undefined if service is not registered', () => {
      const instance = registry.tryGet('nonexistent');
      expect(instance).toBeUndefined();
    });
  });

  describe('initializeAll', () => {
    it('should call init on all Initializable services', async () => {
      const initSpy1 = vi.fn();
      const initSpy2 = vi.fn();

      class Service1 implements Initializable {
        init() {
          initSpy1();
        }
      }

      class Service2 implements Initializable {
        init() {
          initSpy2();
        }
      }

      registry.registerClass('service1', Service1);
      registry.registerClass('service2', Service2);

      await registry.initializeAll();

      expect(initSpy1).toHaveBeenCalled();
      expect(initSpy2).toHaveBeenCalled();
    });

    it('should handle async init methods', async () => {
      const initSpy = vi.fn();

      class AsyncService implements Initializable {
        async init() {
          await new Promise((resolve) => setTimeout(resolve, 10));
          initSpy();
        }
      }

      registry.registerClass('async-service', AsyncService);

      await registry.initializeAll();

      expect(initSpy).toHaveBeenCalled();
    });

    it('should not call init on non-singleton services', async () => {
      const initSpy = vi.fn();

      class Service implements Initializable {
        init() {
          initSpy();
        }
      }

      registry.registerClass('service', Service, { singleton: false });

      await registry.initializeAll();

      expect(initSpy).not.toHaveBeenCalled();
    });
  });

  describe('disposeAll', () => {
    it('should call dispose on all Disposable services', async () => {
      const disposeSpy1 = vi.fn();
      const disposeSpy2 = vi.fn();

      class Service1 implements Disposable {
        dispose() {
          disposeSpy1();
        }
      }

      class Service2 implements Disposable {
        dispose() {
          disposeSpy2();
        }
      }

      registry.registerClass('service1', Service1);
      registry.registerClass('service2', Service2);

      // Get instances to trigger creation
      registry.get('service1');
      registry.get('service2');

      await registry.disposeAll();

      expect(disposeSpy1).toHaveBeenCalled();
      expect(disposeSpy2).toHaveBeenCalled();
    });

    it('should handle async dispose methods', async () => {
      const disposeSpy = vi.fn();

      class AsyncService implements Disposable {
        async dispose() {
          await new Promise((resolve) => setTimeout(resolve, 10));
          disposeSpy();
        }
      }

      registry.registerClass('async-service', AsyncService);
      registry.get('async-service');

      await registry.disposeAll();

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should clear all services after disposal', async () => {
      registry.register('service', () => ({}));
      registry.get('service');

      await registry.disposeAll();

      expect(registry.has('service')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear cached instance for a specific service', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { value: callCount };
      };

      registry.register('test-service', factory);

      const instance1 = registry.get<{ value: number }>('test-service');
      expect(instance1.value).toBe(1);

      registry.clear('test-service');

      const instance2 = registry.get<{ value: number }>('test-service');
      expect(instance2.value).toBe(2);
      expect(instance1).not.toBe(instance2);
    });

    it('should not affect registration when clearing', () => {
      registry.register('test-service', () => ({ value: 42 }));
      registry.clear('test-service');

      expect(registry.has('test-service')).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear all services and registrations', () => {
      registry.register('service1', () => ({}));
      registry.register('service2', () => ({}));

      registry.reset();

      expect(registry.has('service1')).toBe(false);
      expect(registry.has('service2')).toBe(false);
    });
  });
});

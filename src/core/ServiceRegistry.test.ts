import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceRegistry, Disposable, Initializable } from './ServiceRegistry';

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;
  const TestServiceToken = Symbol('TestService');
  const DependencyToken = Symbol('Dependency');
  const ServiceAToken = Symbol('ServiceA');
  const ServiceBToken = Symbol('ServiceB');
  const Service1Token = Symbol('Service1');
  const Service2Token = Symbol('Service2');
  const AsyncServiceToken = Symbol('AsyncService');

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  describe('register', () => {
    it('should register a service with a factory function', () => {
      const factory = () => ({ value: 42 });
      registry.register(TestServiceToken, factory);

      expect(registry.has(TestServiceToken)).toBe(true);
    });

    it('should throw error when registering duplicate service', () => {
      const factory = () => ({ value: 42 });
      registry.register(TestServiceToken, factory);

      expect(() => {
        registry.register(TestServiceToken, factory);
      }).toThrow('Service already registered');
    });

    it('should register as singleton by default', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { value: callCount };
      };

      registry.register(TestServiceToken, factory);

      const instance1 = registry.get(TestServiceToken);
      const instance2 = registry.get(TestServiceToken);

      expect(instance1).toBe(instance2);
      expect(callCount).toBe(1);
    });

    it('should create new instances when not singleton', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { value: callCount };
      };

      registry.register(TestServiceToken, factory, { singleton: false });

      const instance1 = registry.get<{ value: number }>(TestServiceToken);
      const instance2 = registry.get<{ value: number }>(TestServiceToken);

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

      registry.registerClass(TestServiceToken, TestService);

      const instance = registry.get<TestService>(TestServiceToken);
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

      registry.registerClass(DependencyToken, DependencyService);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      registry.registerClass(TestServiceToken, TestService as any, {
        dependencies: [DependencyToken],
      });

      const instance = registry.get<TestService>(TestServiceToken);
      expect(instance.dep).toBeInstanceOf(DependencyService);
      expect(instance.dep.value).toBe(10);
    });
  });

  describe('get', () => {
    it('should throw error when service is not registered', () => {
      const NonExistentToken = Symbol('Nonexistent');
      expect(() => {
        registry.get(NonExistentToken);
      }).toThrow('Service not registered');
    });

    it('should detect circular dependencies', () => {
      registry.register(ServiceAToken, () => registry.get(ServiceBToken));
      registry.register(ServiceBToken, () => registry.get(ServiceAToken));

      expect(() => {
        registry.get(ServiceAToken);
      }).toThrow('Circular dependency detected');
    });

    it('should return cached singleton instance', () => {
      const factory = vi.fn(() => ({ value: 42 }));
      registry.register(TestServiceToken, factory);

      registry.get(TestServiceToken);
      registry.get(TestServiceToken);

      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe('has', () => {
    it('should return true for registered services', () => {
      registry.register(TestServiceToken, () => ({}));
      expect(registry.has(TestServiceToken)).toBe(true);
    });

    it('should return false for unregistered services', () => {
      const NonExistentToken = Symbol('Nonexistent');
      expect(registry.has(NonExistentToken)).toBe(false);
    });
  });

  describe('tryGet', () => {
    it('should return service instance if registered', () => {
      registry.register(TestServiceToken, () => ({ value: 42 }));
      const instance = registry.tryGet<{ value: number }>(TestServiceToken);

      expect(instance).toBeDefined();
      expect(instance?.value).toBe(42);
    });

    it('should return undefined if service is not registered', () => {
      const NonExistentToken = Symbol('Nonexistent');
      const instance = registry.tryGet(NonExistentToken);
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

      registry.registerClass(Service1Token, Service1);
      registry.registerClass(Service2Token, Service2);

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

      registry.registerClass(AsyncServiceToken, AsyncService);

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

      registry.registerClass(TestServiceToken, Service, { singleton: false });

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

      registry.registerClass(Service1Token, Service1);
      registry.registerClass(Service2Token, Service2);

      // Get instances to trigger creation
      registry.get(Service1Token);
      registry.get(Service2Token);

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

      registry.registerClass(AsyncServiceToken, AsyncService);
      registry.get(AsyncServiceToken);

      await registry.disposeAll();

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should clear all services after disposal', async () => {
      registry.register(TestServiceToken, () => ({}));
      registry.get(TestServiceToken);

      await registry.disposeAll();

      expect(registry.has(TestServiceToken)).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear cached instance for a specific service', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { value: callCount };
      };

      registry.register(TestServiceToken, factory);

      const instance1 = registry.get<{ value: number }>(TestServiceToken);
      expect(instance1.value).toBe(1);

      registry.clear(TestServiceToken);

      const instance2 = registry.get<{ value: number }>(TestServiceToken);
      expect(instance2.value).toBe(2);
      expect(instance1).not.toBe(instance2);
    });

    it('should not affect registration when clearing', () => {
      registry.register(TestServiceToken, () => ({ value: 42 }));
      registry.clear(TestServiceToken);

      expect(registry.has(TestServiceToken)).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear all services and registrations', () => {
      registry.register(Service1Token, () => ({}));
      registry.register(Service2Token, () => ({}));

      registry.reset();

      expect(registry.has(Service1Token)).toBe(false);
      expect(registry.has(Service2Token)).toBe(false);
    });
  });
});

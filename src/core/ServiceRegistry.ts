/**
 * ServiceRegistry - Central instantiation service
 * Manages creation and lifecycle of application services and components
 */

import type { ServiceToken } from './types';

type ServiceFactory<T> = () => T;
type ServiceConstructor<T> = new (...args: unknown[]) => T;

interface ServiceDescriptor<T> {
  factory: ServiceFactory<T>;
  singleton: boolean;
  instance?: T;
  dependencies?: ServiceToken[];
}

export interface Disposable {
  dispose(): void | Promise<void>;
}

export interface Initializable {
  init(): void | Promise<void>;
}

/**
 * ServiceRegistry provides centralized service instantiation and lifecycle management.
 * Avoids scattered `new` calls throughout the application.
 */
export class ServiceRegistry {
  private services = new Map<ServiceToken, ServiceDescriptor<unknown>>();
  private initializing = new Set<ServiceToken>();

  /**
   * Register a service with a factory function
   */
  register<T>(
    token: ServiceToken,
    factory: ServiceFactory<T>,
    options: { singleton?: boolean; dependencies?: ServiceToken[] } = {}
  ): void {
    if (this.services.has(token)) {
      throw new Error(`Service already registered: ${String(token)}`);
    }

    this.services.set(token, {
      factory: factory as ServiceFactory<unknown>,
      singleton: options.singleton ?? true,
      dependencies: options.dependencies,
    });
  }

  /**
   * Register a service with a constructor
   */
  registerClass<T>(
    token: ServiceToken,
    constructor: ServiceConstructor<T>,
    options: { singleton?: boolean; dependencies?: ServiceToken[] } = {}
  ): void {
    this.register(
      token,
      () => {
        const deps = options.dependencies?.map((dep) => this.get(dep)) ?? [];
        return new constructor(...deps);
      },
      options
    );
  }

  /**
   * Get a service instance
   */
  get<T>(token: ServiceToken): T {
    const descriptor = this.services.get(token);
    if (!descriptor) {
      throw new Error(`Service not registered: ${String(token)}`);
    }

    // Check for circular dependencies
    if (this.initializing.has(token)) {
      throw new Error(`Circular dependency detected for service: ${String(token)}`);
    }

    // Return cached singleton instance
    if (descriptor.singleton && descriptor.instance) {
      return descriptor.instance as T;
    }

    // Create new instance
    try {
      this.initializing.add(token);
      const instance = descriptor.factory();

      // Cache singleton
      if (descriptor.singleton) {
        descriptor.instance = instance;
      }

      return instance as T;
    } finally {
      this.initializing.delete(token);
    }
  }

  /**
   * Check if a service is registered
   */
  has(token: ServiceToken): boolean {
    return this.services.has(token);
  }

  /**
   * Get a service if it exists, otherwise return undefined
   */
  tryGet<T>(token: ServiceToken): T | undefined {
    try {
      return this.get<T>(token);
    } catch {
      return undefined;
    }
  }

  /**
   * Initialize all registered services that implement Initializable
   */
  async initializeAll(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    for (const [token, descriptor] of this.services) {
      if (descriptor.singleton) {
        const instance = this.get(token);
        if (this.isInitializable(instance)) {
          const result = instance.init();
          if (result instanceof Promise) {
            initPromises.push(result);
          }
        }
      }
    }

    await Promise.all(initPromises);
  }

  /**
   * Dispose all services that implement Disposable
   */
  async disposeAll(): Promise<void> {
    const disposePromises: Promise<void>[] = [];

    for (const descriptor of this.services.values()) {
      if (descriptor.instance && this.isDisposable(descriptor.instance)) {
        const result = descriptor.instance.dispose();
        if (result instanceof Promise) {
          disposePromises.push(result);
        }
      }
    }

    await Promise.all(disposePromises);
    this.services.clear();
  }

  /**
   * Clear a specific service instance (useful for testing)
   */
  clear(token: ServiceToken): void {
    const descriptor = this.services.get(token);
    if (descriptor) {
      descriptor.instance = undefined;
    }
  }

  /**
   * Reset the entire registry
   */
  reset(): void {
    this.services.clear();
    this.initializing.clear();
  }

  private isInitializable(obj: unknown): obj is Initializable {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'init' in obj &&
      typeof (obj as Initializable).init === 'function'
    );
  }

  private isDisposable(obj: unknown): obj is Disposable {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'dispose' in obj &&
      typeof (obj as Disposable).dispose === 'function'
    );
  }
}

// Global singleton instance
let globalRegistry: ServiceRegistry | null = null;

/**
 * Get the global service registry instance
 */
export function getServiceRegistry(): ServiceRegistry {
  if (!globalRegistry) {
    globalRegistry = new ServiceRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global service registry (useful for testing)
 */
export function resetServiceRegistry(): void {
  globalRegistry = null;
}

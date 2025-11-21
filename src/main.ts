/**
 * Main entry point for NC-Edit7 application
 */

import { getServiceRegistry } from '@core/ServiceRegistry';
import { SERVICE_TOKENS } from '@core/types';
import { EventBus } from '@services/EventBus';
import { StateService } from '@services/StateService';
import { BackendGateway } from '@services/BackendGateway';

/**
 * Bootstrap the application
 */
async function bootstrap() {
  console.log('NC-Edit7 starting...');

  try {
    // Get service registry
    const registry = getServiceRegistry();

    // Register core services
    registry.registerClass(SERVICE_TOKENS.EventBus, EventBus, { singleton: true });
    
    registry.register(
      SERVICE_TOKENS.StateService,
      () => {
        const eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);
        return new StateService(eventBus);
      },
      { singleton: true, dependencies: [SERVICE_TOKENS.EventBus] }
    );

    registry.register(
      SERVICE_TOKENS.BackendGateway,
      () => new BackendGateway(),
      { singleton: true }
    );

    // Initialize services
    await registry.initializeAll();

    console.log('Services initialized successfully');

    // Test the services
    const eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);
    const stateService = registry.get<StateService>(SERVICE_TOKENS.StateService);
    const backendGateway = registry.get<BackendGateway>(SERVICE_TOKENS.BackendGateway);

    console.log('EventBus:', eventBus);
    console.log('StateService:', stateService);
    console.log('BackendGateway:', backendGateway);

    // Subscribe to events
    eventBus.on('*', (event) => {
      console.log('Event:', event);
    });

    // Update the loading message
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.innerHTML = `
        <div style="padding: 20px;">
          <h1>NC-Edit7 - Multi-Channel CNC Editor</h1>
          <p style="margin-top: 10px;">Phase 1: Setup & Tooling - Complete ✓</p>
          <p style="margin-top: 5px; color: #888;">Services initialized. Ready for component development.</p>
          <div style="margin-top: 20px; padding: 15px; background: #2d2d30; border-radius: 4px;">
            <h3>Architecture Status:</h3>
            <ul style="list-style: none; padding: 0; margin-top: 10px;">
              <li style="padding: 5px 0;">✓ ServiceRegistry (Instantiation Service)</li>
              <li style="padding: 5px 0;">✓ EventBus (Pub/Sub)</li>
              <li style="padding: 5px 0;">✓ StateService (State Management)</li>
              <li style="padding: 5px 0;">✓ BackendGateway (Server Communication)</li>
              <li style="padding: 5px 0;">✓ Core Types & Interfaces</li>
            </ul>
          </div>
          <div style="margin-top: 20px; padding: 15px; background: #1e3a5f; border-radius: 4px;">
            <h3>Next Steps:</h3>
            <ul style="list-style: none; padding: 0; margin-top: 10px;">
              <li style="padding: 5px 0;">→ Parser Service (Browser & Worker)</li>
              <li style="padding: 5px 0;">→ Machine Service</li>
              <li style="padding: 5px 0;">→ Web Components (Editor, Channels, Plot)</li>
              <li style="padding: 5px 0;">→ ACE Editor Integration</li>
              <li style="padding: 5px 0;">→ Three.js Plot Integration</li>
            </ul>
          </div>
        </div>
      `;
    }

    console.log('NC-Edit7 bootstrap complete');
  } catch (error) {
    console.error('Failed to bootstrap NC-Edit7:', error);
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.innerHTML = `
        <div style="padding: 20px; color: #f48771;">
          <h1>Error</h1>
          <p>Failed to initialize NC-Edit7: ${error instanceof Error ? error.message : String(error)}</p>
        </div>
      `;
    }
  }
}

// Start the application
bootstrap();

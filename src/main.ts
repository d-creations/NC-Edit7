/**
 * Main entry point for NC-Edit7 application
 */

import { getServiceRegistry } from '@core/ServiceRegistry';
import { SERVICE_TOKENS } from '@core/types';
import { EventBus } from '@services/EventBus';
import { StateService } from '@services/StateService';
import { BackendGateway } from '@services/BackendGateway';
import { MachineService } from '@services/MachineService';
import { ParserService } from '@services/ParserService';
import { ExecutedProgramService } from '@services/ExecutedProgramService';
import { PlotService } from '@services/PlotService';
import { UserPreferenceService } from '@services/UserPreferenceService';
import { DiagnosticsService } from '@services/DiagnosticsService';

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

    registry.register(
      SERVICE_TOKENS.MachineService,
      () => {
        const backendGateway = registry.get<BackendGateway>(SERVICE_TOKENS.BackendGateway);
        const eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);
        return new MachineService(backendGateway, eventBus);
      },
      { singleton: true, dependencies: [SERVICE_TOKENS.BackendGateway, SERVICE_TOKENS.EventBus] }
    );

    registry.register(
      SERVICE_TOKENS.ParserService,
      () => {
        const eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);
        return new ParserService(eventBus);
      },
      { singleton: true, dependencies: [SERVICE_TOKENS.EventBus] }
    );

    registry.register(
      SERVICE_TOKENS.ExecutedProgramService,
      () => {
        const backendGateway = registry.get<BackendGateway>(SERVICE_TOKENS.BackendGateway);
        const stateService = registry.get<StateService>(SERVICE_TOKENS.StateService);
        const eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);
        return new ExecutedProgramService(backendGateway, stateService, eventBus);
      },
      { 
        singleton: true, 
        dependencies: [SERVICE_TOKENS.BackendGateway, SERVICE_TOKENS.StateService, SERVICE_TOKENS.EventBus] 
      }
    );

    registry.registerClass(SERVICE_TOKENS.PlotService, PlotService, { singleton: true });

    registry.registerClass(SERVICE_TOKENS.UserPreferenceService, UserPreferenceService, { 
      singleton: true 
    });

    registry.register(
      SERVICE_TOKENS.DiagnosticsService,
      () => {
        const eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);
        return new DiagnosticsService(eventBus);
      },
      { singleton: true, dependencies: [SERVICE_TOKENS.EventBus] }
    );

    // Initialize services
    await registry.initializeAll();

    console.log('Services initialized successfully');

    // Test the services
    const eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);
    const stateService = registry.get<StateService>(SERVICE_TOKENS.StateService);
    const backendGateway = registry.get<BackendGateway>(SERVICE_TOKENS.BackendGateway);
    const machineService = registry.get<MachineService>(SERVICE_TOKENS.MachineService);
    const parserService = registry.get<ParserService>(SERVICE_TOKENS.ParserService);
    const plotService = registry.get<PlotService>(SERVICE_TOKENS.PlotService);
    const userPrefService = registry.get<UserPreferenceService>(SERVICE_TOKENS.UserPreferenceService);
    const diagnosticsService = registry.get<DiagnosticsService>(SERVICE_TOKENS.DiagnosticsService);

    console.log('All services initialized:', {
      eventBus,
      stateService,
      backendGateway,
      machineService,
      parserService,
      plotService,
      userPrefService,
      diagnosticsService,
    });

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
          <p style="margin-top: 10px;">Phase 2: Parser & Domain Services - Complete ✓</p>
          <p style="margin-top: 5px; color: #888;">All core services implemented and initialized.</p>
          <div style="margin-top: 20px; padding: 15px; background: #2d2d30; border-radius: 4px;">
            <h3>Architecture Status:</h3>
            <ul style="list-style: none; padding: 0; margin-top: 10px;">
              <li style="padding: 5px 0;">✓ ServiceRegistry (Instantiation Service)</li>
              <li style="padding: 5px 0;">✓ EventBus (Pub/Sub)</li>
              <li style="padding: 5px 0;">✓ StateService (State Management)</li>
              <li style="padding: 5px 0;">✓ BackendGateway (Server Communication)</li>
              <li style="padding: 5px 0;">✓ MachineService (Machine Profile Management)</li>
              <li style="padding: 5px 0;">✓ ParserService (NC Code Parsing)</li>
              <li style="padding: 5px 0;">✓ ExecutedProgramService (Server Execution)</li>
              <li style="padding: 5px 0;">✓ PlotService (Plot Data Management)</li>
              <li style="padding: 5px 0;">✓ UserPreferenceService (Settings Persistence)</li>
              <li style="padding: 5px 0;">✓ DiagnosticsService (Error Aggregation)</li>
              <li style="padding: 5px 0;">✓ Core Types & Interfaces</li>
            </ul>
          </div>
          <div style="margin-top: 20px; padding: 15px; background: #1e3a5f; border-radius: 4px;">
            <h3>Next Steps:</h3>
            <ul style="list-style: none; padding: 0; margin-top: 10px;">
              <li style="padding: 5px 0;">→ Web Components (Root App, Channels)</li>
              <li style="padding: 5px 0;">→ ACE Editor Integration</li>
              <li style="padding: 5px 0;">→ Three.js Plot Component</li>
              <li style="padding: 5px 0;">→ UI Components (Panels, Drawers, Controls)</li>
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

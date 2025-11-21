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
import { CloudAgentService } from '@services/CloudAgentService';
import '@components/NCEditorApp';

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

    registry.register(SERVICE_TOKENS.BackendGateway, () => new BackendGateway(), {
      singleton: true,
    });

    // Register CloudAgentService early so it can be used by other services
    registry.register(
      SERVICE_TOKENS.CloudAgentService,
      () => {
        const backendGateway = registry.get<BackendGateway>(SERVICE_TOKENS.BackendGateway);
        const eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);
        return new CloudAgentService(backendGateway, eventBus, {
          enabled: true,
          autoDelegate: true,
        });
      },
      {
        singleton: true,
        dependencies: [SERVICE_TOKENS.BackendGateway, SERVICE_TOKENS.EventBus],
      }
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
        const cloudAgentService = registry.get<CloudAgentService>(SERVICE_TOKENS.CloudAgentService);
        return new ParserService(eventBus, cloudAgentService);
      },
      {
        singleton: true,
        dependencies: [SERVICE_TOKENS.EventBus, SERVICE_TOKENS.CloudAgentService],
      }
    );

    registry.register(
      SERVICE_TOKENS.ExecutedProgramService,
      () => {
        const backendGateway = registry.get<BackendGateway>(SERVICE_TOKENS.BackendGateway);
        const stateService = registry.get<StateService>(SERVICE_TOKENS.StateService);
        const eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);
        const cloudAgentService = registry.get<CloudAgentService>(SERVICE_TOKENS.CloudAgentService);
        return new ExecutedProgramService(
          backendGateway,
          stateService,
          eventBus,
          cloudAgentService
        );
      },
      {
        singleton: true,
        dependencies: [
          SERVICE_TOKENS.BackendGateway,
          SERVICE_TOKENS.StateService,
          SERVICE_TOKENS.EventBus,
          SERVICE_TOKENS.CloudAgentService,
        ],
      }
    );

    registry.registerClass(SERVICE_TOKENS.PlotService, PlotService, { singleton: true });

    registry.registerClass(SERVICE_TOKENS.UserPreferenceService, UserPreferenceService, {
      singleton: true,
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
    const userPrefService = registry.get<UserPreferenceService>(
      SERVICE_TOKENS.UserPreferenceService
    );
    const diagnosticsService = registry.get<DiagnosticsService>(SERVICE_TOKENS.DiagnosticsService);
    const cloudAgentService = registry.get<CloudAgentService>(SERVICE_TOKENS.CloudAgentService);

    console.log('All services initialized:', {
      eventBus,
      stateService,
      backendGateway,
      machineService,
      parserService,
      plotService,
      userPrefService,
      diagnosticsService,
      cloudAgentService,
    });

    // Update the loading message and mount the app
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.innerHTML = '<nc-editor-app></nc-editor-app>';
    }

    console.log('NC-Edit7 bootstrap complete');
  } catch (error) {
    console.error('Failed to bootstrap NC-Edit7:', error);

    // Still mount the app even if there was an error
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.innerHTML = '<nc-editor-app></nc-editor-app>';
    }
  }
}

// Start the application
bootstrap();

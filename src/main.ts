// Main entry point for NC-Edit7 application

import { ServiceRegistry, ServiceScope } from '@core/ServiceRegistry';
import {
  EVENT_BUS_TOKEN,
  STATE_SERVICE_TOKEN,
  BACKEND_GATEWAY_TOKEN,
  MACHINE_SERVICE_TOKEN,
  PARSER_SERVICE_TOKEN,
} from '@core/ServiceTokens';
import { EventBus } from '@services/EventBus';
import { StateService } from '@services/StateService';
import { BackendGateway } from '@services/BackendGateway';
import { MachineService } from '@services/MachineService';
import { ParserService } from '@services/ParserService';
import '@components/NCEditorApp';

// Bootstrap application
async function bootstrap() {
  try {
    const registry = ServiceRegistry.getInstance();

    // Register services using the tokens directly
    registry.register(EVENT_BUS_TOKEN, () => new EventBus(), ServiceScope.Singleton);

    registry.register(BACKEND_GATEWAY_TOKEN, () => new BackendGateway(), ServiceScope.Singleton);

    registry.register(
      STATE_SERVICE_TOKEN,
      () => {
        const eventBus = registry.get(EVENT_BUS_TOKEN);
        return new StateService(eventBus);
      },
      ServiceScope.Singleton,
    );

    registry.register(
      MACHINE_SERVICE_TOKEN,
      () => {
        const backend = registry.get(BACKEND_GATEWAY_TOKEN);
        const eventBus = registry.get(EVENT_BUS_TOKEN);
        return new MachineService(backend, eventBus);
      },
      ServiceScope.Singleton,
    );

    registry.register(
      PARSER_SERVICE_TOKEN,
      () => {
        const eventBus = registry.get(EVENT_BUS_TOKEN);
        return new ParserService(eventBus);
      },
      ServiceScope.Singleton,
    );

    // Initialize the app
    const appElement = document.createElement('nc-editor-app');
    const appContainer = document.getElementById('app');

    if (!appContainer) {
      throw new Error('App container not found');
    }

    // Clear loading message
    appContainer.innerHTML = '';
    appContainer.appendChild(appElement);

    console.log('NC-Edit7 application initialized successfully');
  } catch (error) {
    console.error('Failed to bootstrap application:', error);

    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          flex-direction: column;
          gap: 16px;
        ">
          <div style="color: #f48771; font-size: 24px;">Failed to Initialize</div>
          <div style="color: #d4d4d4;">
            ${error instanceof Error ? error.message : 'Unknown error'}
          </div>
          <button 
            onclick="location.reload()" 
            style="
              padding: 8px 16px;
              background: #0e639c;
              color: #fff;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            "
          >
            Reload
          </button>
        </div>
      `;
    }
  }
}

// Error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// Cleanup on page unload
window.addEventListener('beforeunload', async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.disposeAll();
});

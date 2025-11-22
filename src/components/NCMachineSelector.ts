import { ServiceRegistry } from '@core/ServiceRegistry';
import { MACHINE_SERVICE_TOKEN, STATE_SERVICE_TOKEN } from '@core/ServiceTokens';
import { MachineService } from '@services/MachineService';
import { StateService } from '@services/StateService';
import type { MachineType } from '@core/types';

export class NCMachineSelector extends HTMLElement {
  private machineService: MachineService;
  private stateService: StateService;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.machineService = ServiceRegistry.getInstance().get(MACHINE_SERVICE_TOKEN);
    this.stateService = ServiceRegistry.getInstance().get(STATE_SERVICE_TOKEN);
  }

  connectedCallback() {
    this.render();
    this.updateOptions();
    this.attachEventListeners();
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
        }
        select {
          padding: 4px 8px;
          background: #3c3c3c;
          color: #d4d4d4;
          border: 1px solid #555;
          border-radius: 4px;
          cursor: pointer;
        }
      </style>
      <select id="selector">
        <option value="">Select Machine...</option>
      </select>
    `;
  }

  private updateOptions() {
    const selector = this.shadowRoot?.getElementById('selector') as HTMLSelectElement;
    if (!selector) return;

    const machines = this.machineService.getMachines();
    selector.innerHTML = '<option value="">Select Machine...</option>';

    machines.forEach((machine) => {
      const option = document.createElement('option');
      option.value = machine.machineName;
      option.textContent = machine.machineName;
      selector.appendChild(option);
    });
  }

  private attachEventListeners() {
    const selector = this.shadowRoot?.getElementById('selector') as HTMLSelectElement;
    selector?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const machineType = target.value as MachineType;
      if (machineType) {
        this.stateService.setGlobalMachine(machineType);
      }
    });
  }
}

customElements.define('nc-machine-selector', NCMachineSelector);

import * as THREE from 'three';
import { ServiceRegistry } from '@core/ServiceRegistry';
import {
  PLOT_SERVICE_TOKEN,
  EVENT_BUS_TOKEN,
  EXECUTED_PROGRAM_SERVICE_TOKEN,
  STATE_SERVICE_TOKEN,
} from '@core/ServiceTokens';
import { PlotService } from '@services/PlotService';
import { EventBus, EVENT_NAMES } from '@services/EventBus';
import { ExecutedProgramService } from '@services/ExecutedProgramService';
import { StateService } from '@services/StateService';
import type { PlotMetadata, MachineType } from '@core/types';

export class NCToolpathPlot extends HTMLElement {
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private plotService: PlotService;
  private eventBus: EventBus;
  private executedProgramService: ExecutedProgramService;
  private stateService: StateService;
  private animationFrameId?: number;
  private isVisible = false;
  private resizeObserver?: ResizeObserver;
  private isPlotting = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    const registry = ServiceRegistry.getInstance();
    this.plotService = registry.get(PLOT_SERVICE_TOKEN);
    this.eventBus = registry.get(EVENT_BUS_TOKEN);
    this.executedProgramService = registry.get(EXECUTED_PROGRAM_SERVICE_TOKEN);
    this.stateService = registry.get(STATE_SERVICE_TOKEN);
  }

  connectedCallback() {
    this.render();
    this.initThree();
    this.setupEventListeners();
  }

  disconnectedCallback() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  private setupEventListeners() {
    // Listen for plot updates
    this.eventBus.subscribe(EVENT_NAMES.EXECUTION_COMPLETED, (data: unknown) => {
      const executionData = data as { result?: { plotMetadata?: PlotMetadata } };
      if (executionData.result?.plotMetadata) {
        this.updatePlot(executionData.result.plotMetadata);
      }
    });

    // Allow external UI elements to request a plot
    this.eventBus.subscribe(EVENT_NAMES.PLOT_REQUEST, () => {
      this.plotNCCode();
    });

    // Listen for plot toggle
    this.eventBus.subscribe(EVENT_NAMES.STATE_CHANGED, (data: unknown) => {
      const stateData = data as { uiSettings?: { plotViewerOpen?: boolean } };
      if (stateData.uiSettings?.plotViewerOpen !== undefined) {
        this.isVisible = stateData.uiSettings.plotViewerOpen;
        this.updateVisibility();
      }
    });
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
          background: #1e1e1e;
          position: relative;
        }
        :host([hidden]) {
          display: none;
        }
        #plot-container {
          width: 100%;
          height: 100%;
          position: relative;
        }
        .plot-controls {
          position: absolute;
          top: 8px;
          right: 8px;
          display: flex;
          gap: 4px;
          z-index: 10;
        }
        .plot-button {
          padding: 4px 8px;
          background: #3c3c3c;
          color: #d4d4d4;
          border: 1px solid #555;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        .plot-button:hover {
          background: #4c4c4c;
        }
        .plot-button.primary {
          background: #0e639c;
          color: #fff;
          border: 1px solid #0e639c;
        }
        .plot-button.primary:hover {
          background: #1177bb;
        }
        .plot-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .plot-info {
          position: absolute;
          bottom: 8px;
          left: 8px;
          color: #d4d4d4;
          font-size: 12px;
          background: rgba(30, 30, 30, 0.8);
          padding: 4px 8px;
          border-radius: 4px;
        }
      </style>
      <div id="plot-container">
        <div class="plot-controls">
          <button class="plot-button primary" id="plot-nc-code">📊 Plot NC Code</button>
          <button class="plot-button" id="reset-camera">Reset View</button>
          <button class="plot-button" id="toggle-axes">Axes</button>
        </div>
        <div class="plot-info">
          <div id="plot-status">No plot data</div>
        </div>
      </div>
    `;
    this.attachControlListeners();
  }

  private attachControlListeners() {
    const plotButton = this.shadowRoot?.getElementById('plot-nc-code');
    plotButton?.addEventListener('click', () => this.plotNCCode());

    const resetButton = this.shadowRoot?.getElementById('reset-camera');
    resetButton?.addEventListener('click', () => this.resetCamera());

    const axesButton = this.shadowRoot?.getElementById('toggle-axes');
    axesButton?.addEventListener('click', () => this.toggleAxes());
  }

  private async plotNCCode() {
    if (this.isPlotting) return;

    const plotButton = this.shadowRoot?.getElementById('plot-nc-code') as HTMLButtonElement;
    const statusElement = this.shadowRoot?.getElementById('plot-status');

    try {
      this.isPlotting = true;
      if (plotButton) {
        plotButton.disabled = true;
        plotButton.textContent = '⏳ Plotting...';
      }
      if (statusElement) {
        statusElement.textContent = 'Generating plot...';
      }

      // Get all active channels and their NC code
      const activeChannels = this.stateService.getActiveChannels();
      const state = this.stateService.getState();
      const machineName = state.globalMachine || 'ISO_MILL';

      if (activeChannels.length === 0) {
        throw new Error('No active channels');
      }

      // Get the code from the editor elements in the DOM
      const requests = activeChannels.map((channel) => {
        // Query the nc-code-pane element for this channel
        const codePane = document.querySelector(
          `nc-channel-pane[data-channel="${channel.id}"] nc-code-pane`,
        ) as (HTMLElement & { getValue: () => string }) | null;

        const program = codePane?.getValue() || channel.program || '';

        return {
          channelId: channel.id,
          program,
          machineName: machineName as MachineType,
        };
      });

      // Execute the programs to get plot data
      const results = await this.executedProgramService.executeMultipleChannels(requests);

      // Update the plot with the results
      let totalPoints = 0;
      let totalSegments = 0;
      results.forEach((result) => {
        if (result.plotMetadata) {
          totalPoints += result.plotMetadata.points.length;
          totalSegments += result.plotMetadata.segments.length;
          this.updatePlot(result.plotMetadata);
        }
      });

      if (statusElement) {
        statusElement.textContent = `Points: ${totalPoints}, Segments: ${totalSegments}`;
      }
    } catch (error) {
      console.error('Failed to plot NC code:', error);
      if (statusElement) {
        statusElement.textContent = `Error: ${error instanceof Error ? error.message : 'Plot failed'}`;
      }
    } finally {
      this.isPlotting = false;
      if (plotButton) {
        plotButton.disabled = false;
        plotButton.textContent = '📊 Plot NC Code';
      }
    }
  }

  private initThree() {
    const container = this.shadowRoot?.getElementById('plot-container');
    if (!container) return;

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1e1e1e);

    // Camera setup
    const aspect = container.clientWidth / container.clientHeight || 1;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(50, 50, 50);
    this.camera.lookAt(0, 0, 0);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(10, 10, 10);
    this.scene.add(directionalLight);

    // Add machine coordinate system
    const machineGeometry = this.plotService.createMachineGeometry();
    this.scene.add(machineGeometry);

    // Resize observer
    this.resizeObserver = new ResizeObserver(() => {
      this.onResize();
    });
    this.resizeObserver.observe(container);

    // Start animation loop
    this.animateScene();
  }

  private animateScene() {
    this.animationFrameId = requestAnimationFrame(() => this.animateScene());

    if (this.scene && this.camera && this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private onResize() {
    const container = this.shadowRoot?.getElementById('plot-container');
    if (!container || !this.camera || !this.renderer) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private updatePlot(plotMetadata: PlotMetadata) {
    if (!this.scene) return;

    // Clear existing plot lines (keep axes)
    const toRemove: THREE.Object3D[] = [];
    this.scene.children.forEach((child) => {
      if (child instanceof THREE.Line || child instanceof THREE.LineSegments) {
        if (child.userData.isToolpath) {
          toRemove.push(child);
        }
      }
    });
    toRemove.forEach((obj) => this.scene?.remove(obj));

    // Add new plot
    const plotGroup = this.plotService.createSegmentedToolpath(plotMetadata);
    plotGroup.userData.isToolpath = true;
    this.scene.add(plotGroup);

    // Update status
    const statusElement = this.shadowRoot?.getElementById('plot-status');
    if (statusElement) {
      statusElement.textContent = `Points: ${plotMetadata.points.length}, Segments: ${plotMetadata.segments.length}`;
    }
  }

  private resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(50, 50, 50);
    this.camera.lookAt(0, 0, 0);
  }

  private toggleAxes() {
    if (!this.scene) return;
    // Toggle visibility of axes
    this.scene.children.forEach((child) => {
      if (child instanceof THREE.Group && !child.userData.isToolpath) {
        child.visible = !child.visible;
      }
    });
  }

  private updateVisibility() {
    if (this.isVisible) {
      this.removeAttribute('hidden');
    } else {
      this.setAttribute('hidden', '');
    }
  }
}

customElements.define('nc-toolpath-plot', NCToolpathPlot);

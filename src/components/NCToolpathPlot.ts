/**
 * NCToolpathPlot - Three.js plot visualization component
 */

import { BaseComponent } from './BaseComponent';
import { getServiceRegistry } from '@core/ServiceRegistry';
import { SERVICE_TOKENS, type ChannelId, type PlotSegment } from '@core/types';
import type { StateService } from '@services/StateService';
import type { EventBus } from '@services/EventBus';
import * as THREE from 'three';

export class NCToolpathPlot extends BaseComponent {
  private stateService!: StateService;
  private eventBus!: EventBus;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationId?: number;
  private channelMeshes = new Map<ChannelId, THREE.Group>();

  protected onConnected(): void {
    const registry = getServiceRegistry();
    this.stateService = registry.get<StateService>(SERVICE_TOKENS.StateService);
    this.eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);

    this.setupEventListeners();
    this.initializeScene();
    this.startAnimation();
  }

  protected onDisconnected(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  private setupEventListeners(): void {
    this.eventBus.on('execution:completed', (event) => {
      const payload = event.payload as {
        channelId: ChannelId;
        result: { plotData: { channel: ChannelId; segments: PlotSegment[] } };
      };
      this.updatePlot(payload.channelId, payload.result.plotData.segments);
    });

    this.eventBus.on('channel:state-changed', () => {
      this.updateVisibleChannels();
    });
  }

  private initializeScene(): void {
    const container = this.query<HTMLDivElement>('.plot-container');
    if (!container) return;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1e1e1e);

    // Camera
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000);
    this.camera.position.set(100, 100, 100);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    this.scene.add(directionalLight);

    // Grid
    const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x222222);
    this.scene.add(gridHelper);

    // Axes
    const axesHelper = new THREE.AxesHelper(50);
    this.scene.add(axesHelper);

    // Handle resize
    window.addEventListener('resize', () => this.handleResize());
  }

  private animateScene = (): void => {
    this.animationId = requestAnimationFrame(this.animateScene);

    // Rotate camera slowly
    const time = Date.now() * 0.0001;
    this.camera.position.x = Math.cos(time) * 150;
    this.camera.position.z = Math.sin(time) * 150;
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  };

  private startAnimation(): void {
    this.animateScene();
  }

  private handleResize(): void {
    const container = this.query<HTMLDivElement>('.plot-container');
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private updatePlot(channelId: ChannelId, segments: PlotSegment[]): void {
    // Remove existing mesh for this channel
    const existingMesh = this.channelMeshes.get(channelId);
    if (existingMesh) {
      this.scene.remove(existingMesh);
    }

    // Create new group for this channel
    const channelGroup = new THREE.Group();

    // Channel colors
    const channelColors = [0x4ec9b0, 0xdcdcaa, 0xce9178];
    const channelIndex = parseInt(channelId.split('-')[1] || '1') - 1;
    const color = channelColors[channelIndex] || 0x4ec9b0;

    segments.forEach((segment) => {
      if (segment.points.length < 2) return;

      const points: THREE.Vector3[] = [];
      segment.points.forEach((point) => {
        points.push(new THREE.Vector3(point.x, point.z, -point.y)); // Note: Z up in CNC
      });

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color,
        linewidth: segment.type === 'RAPID' ? 1 : 2,
      });

      const line = new THREE.Line(geometry, material);
      channelGroup.add(line);
    });

    this.channelMeshes.set(channelId, channelGroup);
    this.scene.add(channelGroup);
  }

  private updateVisibleChannels(): void {
    const activeChannels = this.stateService.getActiveChannels();
    const activeIds = new Set(activeChannels.map((ch) => ch.id));

    // Show/hide channel meshes based on active state
    this.channelMeshes.forEach((mesh, channelId) => {
      mesh.visible = activeIds.has(channelId);
    });
  }

  protected render(): void {
    this.shadow.innerHTML = '';
    this.shadow.appendChild(this.createStyles(this.getStyles()));

    const container = document.createElement('div');
    container.className = 'nc-toolpath-plot';

    const header = document.createElement('div');
    header.className = 'plot-header';
    header.textContent = 'Toolpath Visualization';
    container.appendChild(header);

    const plotContainer = document.createElement('div');
    plotContainer.className = 'plot-container';
    container.appendChild(plotContainer);

    const controls = this.createControls();
    container.appendChild(controls);

    this.shadow.appendChild(container);

    // Initialize scene after render
    setTimeout(() => {
      if (!this.renderer) {
        this.initializeScene();
        this.startAnimation();
      }
    }, 0);
  }

  private createControls(): HTMLElement {
    const controls = document.createElement('div');
    controls.className = 'plot-controls';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'control-btn';
    resetBtn.textContent = 'Reset View';
    resetBtn.addEventListener('click', () => this.resetView());

    controls.appendChild(resetBtn);
    return controls;
  }

  private resetView(): void {
    this.camera.position.set(100, 100, 100);
    this.camera.lookAt(0, 0, 0);
  }

  private getStyles(): string {
    return `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }

      .nc-toolpath-plot {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        background: #1e1e1e;
        color: #d4d4d4;
      }

      .plot-header {
        padding: 10px 15px;
        background: #2d2d30;
        border-bottom: 1px solid #3e3e42;
        font-weight: 500;
        font-size: 13px;
        text-transform: uppercase;
        color: #888;
      }

      .plot-container {
        flex: 1;
        position: relative;
        overflow: hidden;
      }

      .plot-container canvas {
        display: block;
        width: 100%;
        height: 100%;
      }

      .plot-controls {
        padding: 10px;
        background: #252526;
        border-top: 1px solid #3e3e42;
        display: flex;
        gap: 10px;
      }

      .control-btn {
        padding: 6px 12px;
        background: #0e639c;
        border: none;
        border-radius: 3px;
        color: white;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .control-btn:hover {
        background: #1177bb;
      }
    `;
  }
}

// Register the custom element
customElements.define('nc-toolpath-plot', NCToolpathPlot);

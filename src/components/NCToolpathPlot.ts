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
  private cameraOrbitRadius = 90;
  private cameraAltitude = 60;
  private altitudeStep = 10;
  private isAnimationPaused = false;

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
    this.scene.background = new THREE.Color(0xffffff);

    // Camera
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000);
    this.camera.position.set(this.cameraOrbitRadius, this.cameraAltitude, this.cameraOrbitRadius);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);
    console.log('Plot canvas initialized', {
      canvas: this.renderer.domElement,
      width,
      height,
      containerRect: container.getBoundingClientRect(),
    });

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    this.scene.add(directionalLight);

    // Axes + helper sphere for visibility
    const axesHelper = new THREE.AxesHelper(50);
    this.scene.add(axesHelper);

    const helperSphere = new THREE.Mesh(
      new THREE.SphereGeometry(3, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xff3b3b })
    );
    helperSphere.position.set(0, 0, 0);
    this.scene.add(helperSphere);

    // Handle resize
    window.addEventListener('resize', () => this.handleResize());
  }

  private animateScene = (): void => {
    // Rotate camera slowly
    const time = Date.now() * 0.0001;
    this.updateOrbitPosition(time);

    this.renderer.render(this.scene, this.camera);

    if (!this.isAnimationPaused) {
      this.animationId = requestAnimationFrame(this.animateScene);
    }
  };

  private startAnimation(): void {
    if (this.animationId) {
      return;
    }

    this.isAnimationPaused = false;
    this.animationId = requestAnimationFrame(this.animateScene);
  }

  private pauseAnimation(): void {
    this.isAnimationPaused = true;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }
  }

  private resumeAnimation(): void {
    if (!this.isAnimationPaused) {
      return;
    }

    this.isAnimationPaused = false;
    this.animationId = requestAnimationFrame(this.animateScene);
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
    console.log('NCToolpathPlot updatePlot', channelId, segments);
    // Remove existing mesh for this channel
    const existingMesh = this.channelMeshes.get(channelId);
    if (existingMesh) {
      this.scene.remove(existingMesh);
    }

    // Create new group for this channel
    const channelGroup = new THREE.Group();

    segments.forEach((segment) => {
      if (segment.points.length < 2) return;

      const points: THREE.Vector3[] = [];
      segment.points.forEach((point) => {
        points.push(new THREE.Vector3(point.x, point.z, -point.y));
      });

      const curve = new THREE.CatmullRomCurve3(points);
      const radius = segment.type === 'RAPID' ? 0.4 : 0.8;
      const geometry = new THREE.TubeGeometry(curve, 8, radius, 12, false);
      const material = new THREE.MeshStandardMaterial({
        color: segment.type === 'RAPID' ? 0x79b4ff : 0x1f6eff,
        roughness: 0.35,
        metalness: 0.05,
      });

      const tube = new THREE.Mesh(geometry, material);
      channelGroup.add(tube);
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

    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'control-btn';
    zoomInBtn.textContent = 'Zoom In';
    zoomInBtn.addEventListener('click', () => this.zoomIn());

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'control-btn';
    zoomOutBtn.textContent = 'Zoom Out';
    zoomOutBtn.addEventListener('click', () => this.zoomOut());

    const altitudeUpBtn = document.createElement('button');
    altitudeUpBtn.className = 'control-btn';
    altitudeUpBtn.textContent = 'Altitude +';
    altitudeUpBtn.addEventListener('click', () => this.adjustAltitude(this.altitudeStep));

    const altitudeDownBtn = document.createElement('button');
    altitudeDownBtn.className = 'control-btn';
    altitudeDownBtn.textContent = 'Altitude -';
    altitudeDownBtn.addEventListener('click', () => this.adjustAltitude(-this.altitudeStep));

    const toggleAnimBtn = document.createElement('button');
    toggleAnimBtn.className = 'control-btn';
    toggleAnimBtn.textContent = 'Pause Orbit';
    toggleAnimBtn.addEventListener('click', () => this.toggleAnimation(toggleAnimBtn));

    const resetBtn = document.createElement('button');
    resetBtn.className = 'control-btn';
    resetBtn.textContent = 'Reset View';
    resetBtn.addEventListener('click', () => this.resetView());

    controls.appendChild(zoomInBtn);
    controls.appendChild(zoomOutBtn);
    controls.appendChild(altitudeUpBtn);
    controls.appendChild(altitudeDownBtn);
    controls.appendChild(toggleAnimBtn);
    controls.appendChild(resetBtn);
    return controls;
  }

  private resetView(): void {
    this.cameraOrbitRadius = 90;
    this.cameraAltitude = 60;
    this.updateOrbitPosition();
  }

  private zoomIn(): void {
    this.cameraOrbitRadius = Math.max(20, this.cameraOrbitRadius - 15);
    this.updateOrbitPosition();
  }

  private zoomOut(): void {
    this.cameraOrbitRadius = Math.min(600, this.cameraOrbitRadius + 25);
    this.updateOrbitPosition();
  }

  private adjustAltitude(delta: number): void {
    this.cameraAltitude = Math.min(400, Math.max(15, this.cameraAltitude + delta));
    this.updateOrbitPosition();
  }

  private toggleAnimation(button: HTMLButtonElement): void {
    if (this.isAnimationPaused) {
      this.resumeAnimation();
      button.textContent = 'Pause Orbit';
    } else {
      this.pauseAnimation();
      button.textContent = 'Resume Orbit';
    }
  }

  private updateOrbitPosition(time?: number): void {
    const safeX = this.camera.position.x || 0.0001;
    const safeZ = this.camera.position.z || 0.0001;
    const angle = time ?? Math.atan2(safeZ, safeX);
    this.camera.position.x = Math.cos(angle) * this.cameraOrbitRadius;
    this.camera.position.z = Math.sin(angle) * this.cameraOrbitRadius;
    this.camera.position.y = this.cameraAltitude;
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
        background: #ffffff;
        color: #1b1b1b;
      }

      .plot-header {
        padding: 10px 15px;
        background: #f4f4f4;
        border-bottom: 1px solid #e0e0e0;
        font-weight: 500;
        font-size: 13px;
        text-transform: uppercase;
        color: #555;
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
        background: #f9f9f9;
        border-top: 1px solid #dcdcdc;
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }

      .control-btn {
        padding: 6px 14px;
        background: #1a73e8;
        border: none;
        border-radius: 3px;
        color: white;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.2s, transform 0.2s;
      }

      .control-btn:hover {
        background: #1558b8;
        transform: translateY(-1px);
      }
    `;
  }
}

// Register the custom element
customElements.define('nc-toolpath-plot', NCToolpathPlot);

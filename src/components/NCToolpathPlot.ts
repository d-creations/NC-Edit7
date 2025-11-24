/**
 * NCToolpathPlot - Three.js plot visualization component
 */

import { BaseComponent } from './BaseComponent';
import { getServiceRegistry } from '@core/ServiceRegistry';
import { SERVICE_TOKENS, type ChannelId, type PlotSegment } from '@core/types';
import type { StateService } from '@services/StateService';
import type { EventBus } from '@services/EventBus';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Predefined background colors
const BACKGROUND_COLORS = [
  { name: 'White', color: 0xffffff },
  { name: 'Light Gray', color: 0xf0f0f0 },
  { name: 'Dark Gray', color: 0x2d2d30 },
  { name: 'Black', color: 0x1e1e1e },
  { name: 'Navy', color: 0x1a1a2e },
  { name: 'Blue', color: 0x0a192f },
];

export class NCToolpathPlot extends BaseComponent {
  private stateService!: StateService;
  private eventBus!: EventBus;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private orbitControls!: OrbitControls;
  private animationId?: number;
  private channelMeshes = new Map<ChannelId, THREE.Group>();
  private pendingPlotData = new Map<ChannelId, PlotSegment[]>();
  private isSceneInitialized = false;
  private isAutoRotating = true;
  private currentBgColorIndex = 0;
  private resizeObserver?: ResizeObserver;

  // Deep zoom settings
  private readonly minDistance = 5;
  private readonly maxDistance = 1000;
  private readonly defaultDistance = 120;

  protected onConnected(): void {
    const registry = getServiceRegistry();
    this.stateService = registry.get<StateService>(SERVICE_TOKENS.StateService);
    this.eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);

    this.setupEventListeners();
  }

  protected onDisconnected(): void {
    this.cleanupScene();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private cleanupScene(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }
    if (this.orbitControls) {
      this.orbitControls.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    this.isSceneInitialized = false;
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
    if (!container || this.isSceneInitialized) return;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BACKGROUND_COLORS[this.currentBgColorIndex]!.color);

    // Camera
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 5000);
    this.camera.position.set(
      this.defaultDistance,
      this.defaultDistance * 0.7,
      this.defaultDistance
    );
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // OrbitControls for 3D mouse interaction
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.minDistance = this.minDistance;
    this.orbitControls.maxDistance = this.maxDistance;
    this.orbitControls.autoRotate = this.isAutoRotating;
    this.orbitControls.autoRotateSpeed = 1.0;
    this.orbitControls.enablePan = true;
    this.orbitControls.enableZoom = true;
    this.orbitControls.target.set(0, 0, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    this.scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-50, 50, -50);
    this.scene.add(directionalLight2);

    // Grid helper for better orientation
    const gridHelper = new THREE.GridHelper(200, 20, 0x888888, 0xcccccc);
    this.scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(60);
    this.scene.add(axesHelper);

    // Origin marker sphere
    const helperSphere = new THREE.Mesh(
      new THREE.SphereGeometry(2, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff3b3b })
    );
    helperSphere.position.set(0, 0, 0);
    this.scene.add(helperSphere);

    this.isSceneInitialized = true;

    // Handle resize with ResizeObserver for better responsiveness
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    // Process any pending plot data
    this.processPendingPlotData();

    // Start animation
    this.startAnimation();
  }

  private processPendingPlotData(): void {
    this.pendingPlotData.forEach((segments, channelId) => {
      this.addPlotToScene(channelId, segments);
    });
    this.pendingPlotData.clear();
  }

  private animateScene = (): void => {
    this.orbitControls.update();
    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(this.animateScene);
  };

  private startAnimation(): void {
    if (this.animationId) {
      return;
    }
    this.animationId = requestAnimationFrame(this.animateScene);
  }

  private handleResize(): void {
    const container = this.query<HTMLDivElement>('.plot-container');
    if (!container || !this.renderer || !this.camera) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private updatePlot(channelId: ChannelId, segments: PlotSegment[]): void {
    if (!this.isSceneInitialized) {
      // Store data for later if scene not ready
      this.pendingPlotData.set(channelId, segments);
      return;
    }
    this.addPlotToScene(channelId, segments);
  }

  private addPlotToScene(channelId: ChannelId, segments: PlotSegment[]): void {
    // Remove existing mesh for this channel
    const existingMesh = this.channelMeshes.get(channelId);
    if (existingMesh) {
      this.scene.remove(existingMesh);
      existingMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
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
      const segmentCount = Math.max(points.length * 4, 16);
      const radius = segment.type === 'RAPID' ? 0.5 : 1.0;
      const geometry = new THREE.TubeGeometry(curve, segmentCount, radius, 8, false);
      const material = new THREE.MeshStandardMaterial({
        color: segment.type === 'RAPID' ? 0x79b4ff : 0x1f6eff,
        roughness: 0.4,
        metalness: 0.1,
      });

      const tube = new THREE.Mesh(geometry, material);
      channelGroup.add(tube);
    });

    this.channelMeshes.set(channelId, channelGroup);
    this.scene.add(channelGroup);

    // Auto-fit view to show new content
    this.fitViewToContent();
  }

  private fitViewToContent(): void {
    if (!this.orbitControls || !this.camera) return;

    // Calculate bounding box of all channel meshes
    const box = new THREE.Box3();
    let hasContent = false;

    this.channelMeshes.forEach((group) => {
      if (group.visible) {
        box.expandByObject(group);
        hasContent = true;
      }
    });

    if (!hasContent) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Set orbit target to center of content
    this.orbitControls.target.copy(center);

    // Position camera at appropriate distance
    const distance = Math.max(maxDim * 2, this.defaultDistance);
    const direction = this.camera.position.clone().sub(center).normalize();
    this.camera.position.copy(center).add(direction.multiplyScalar(distance));

    this.orbitControls.update();
  }

  private updateVisibleChannels(): void {
    if (!this.stateService) return;
    const activeChannels = this.stateService.getActiveChannels();
    const activeIds = new Set(activeChannels.map((ch) => ch.id));

    // Show/hide channel meshes based on active state
    this.channelMeshes.forEach((mesh, channelId) => {
      mesh.visible = activeIds.has(channelId);
    });
  }

  protected render(): void {
    // Clean up existing scene before re-render
    this.cleanupScene();

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

    // Initialize scene after DOM is ready
    requestAnimationFrame(() => {
      this.initializeScene();
    });
  }

  private createControls(): HTMLElement {
    const controls = document.createElement('div');
    controls.className = 'plot-controls';

    // Row 1: Zoom and view controls
    const row1 = document.createElement('div');
    row1.className = 'control-row';

    const deepZoomInBtn = document.createElement('button');
    deepZoomInBtn.className = 'control-btn';
    deepZoomInBtn.textContent = 'Zoom ++';
    deepZoomInBtn.title = 'Deep zoom in (close view)';
    deepZoomInBtn.addEventListener('click', () => this.deepZoomIn());

    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'control-btn';
    zoomInBtn.textContent = 'Zoom +';
    zoomInBtn.addEventListener('click', () => this.zoomIn());

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'control-btn';
    zoomOutBtn.textContent = 'Zoom -';
    zoomOutBtn.addEventListener('click', () => this.zoomOut());

    const deepZoomOutBtn = document.createElement('button');
    deepZoomOutBtn.className = 'control-btn';
    deepZoomOutBtn.textContent = 'Zoom --';
    deepZoomOutBtn.title = 'Deep zoom out (far view)';
    deepZoomOutBtn.addEventListener('click', () => this.deepZoomOut());

    row1.appendChild(deepZoomInBtn);
    row1.appendChild(zoomInBtn);
    row1.appendChild(zoomOutBtn);
    row1.appendChild(deepZoomOutBtn);

    // Row 2: 3D control and settings
    const row2 = document.createElement('div');
    row2.className = 'control-row';

    const toggleRotateBtn = document.createElement('button');
    toggleRotateBtn.className = 'control-btn';
    toggleRotateBtn.textContent = this.isAutoRotating ? 'Stop Rotate' : 'Auto Rotate';
    toggleRotateBtn.addEventListener('click', () => this.toggleAutoRotate(toggleRotateBtn));

    const fitViewBtn = document.createElement('button');
    fitViewBtn.className = 'control-btn';
    fitViewBtn.textContent = 'Fit View';
    fitViewBtn.title = 'Fit view to content';
    fitViewBtn.addEventListener('click', () => this.fitViewToContent());

    const resetBtn = document.createElement('button');
    resetBtn.className = 'control-btn';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => this.resetView());

    const bgColorBtn = document.createElement('button');
    bgColorBtn.className = 'control-btn bg-color-btn';
    bgColorBtn.textContent = 'BG Color';
    bgColorBtn.title = 'Change background color';
    bgColorBtn.addEventListener('click', () => this.cycleBackgroundColor(bgColorBtn));

    row2.appendChild(toggleRotateBtn);
    row2.appendChild(fitViewBtn);
    row2.appendChild(resetBtn);
    row2.appendChild(bgColorBtn);

    // Info text
    const infoText = document.createElement('div');
    infoText.className = 'control-info';
    infoText.textContent = 'Mouse: drag to rotate, scroll to zoom, right-drag to pan';

    controls.appendChild(row1);
    controls.appendChild(row2);
    controls.appendChild(infoText);

    return controls;
  }

  private resetView(): void {
    if (!this.orbitControls || !this.camera) return;

    this.camera.position.set(
      this.defaultDistance,
      this.defaultDistance * 0.7,
      this.defaultDistance
    );
    this.orbitControls.target.set(0, 0, 0);
    this.orbitControls.update();
  }

  private zoomIn(): void {
    if (!this.orbitControls) return;
    const currentDistance = this.camera.position.distanceTo(this.orbitControls.target);
    const newDistance = Math.max(this.minDistance, currentDistance * 0.75);
    this.setZoomDistance(newDistance);
  }

  private zoomOut(): void {
    if (!this.orbitControls) return;
    const currentDistance = this.camera.position.distanceTo(this.orbitControls.target);
    const newDistance = Math.min(this.maxDistance, currentDistance * 1.33);
    this.setZoomDistance(newDistance);
  }

  private deepZoomIn(): void {
    if (!this.orbitControls) return;
    const currentDistance = this.camera.position.distanceTo(this.orbitControls.target);
    const newDistance = Math.max(this.minDistance, currentDistance * 0.4);
    this.setZoomDistance(newDistance);
  }

  private deepZoomOut(): void {
    if (!this.orbitControls) return;
    const currentDistance = this.camera.position.distanceTo(this.orbitControls.target);
    const newDistance = Math.min(this.maxDistance, currentDistance * 2.5);
    this.setZoomDistance(newDistance);
  }

  private setZoomDistance(distance: number): void {
    if (!this.orbitControls || !this.camera) return;
    const direction = this.camera.position.clone().sub(this.orbitControls.target).normalize();
    this.camera.position.copy(this.orbitControls.target).add(direction.multiplyScalar(distance));
    this.orbitControls.update();
  }

  private toggleAutoRotate(button: HTMLButtonElement): void {
    this.isAutoRotating = !this.isAutoRotating;
    if (this.orbitControls) {
      this.orbitControls.autoRotate = this.isAutoRotating;
    }
    button.textContent = this.isAutoRotating ? 'Stop Rotate' : 'Auto Rotate';
  }

  private cycleBackgroundColor(button: HTMLButtonElement): void {
    this.currentBgColorIndex = (this.currentBgColorIndex + 1) % BACKGROUND_COLORS.length;
    const bgColor = BACKGROUND_COLORS[this.currentBgColorIndex]!;

    if (this.scene) {
      this.scene.background = new THREE.Color(bgColor.color);
    }

    button.title = `Background: ${bgColor.name}`;
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
        min-height: 200px;
      }

      .plot-container canvas {
        display: block;
        width: 100%;
        height: 100%;
      }

      .plot-controls {
        padding: 8px 10px;
        background: #f9f9f9;
        border-top: 1px solid #dcdcdc;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .control-row {
        display: flex;
        gap: 6px;
        justify-content: center;
        flex-wrap: wrap;
      }

      .control-btn {
        padding: 5px 10px;
        background: #1a73e8;
        border: none;
        border-radius: 3px;
        color: white;
        font-size: 11px;
        cursor: pointer;
        transition: background 0.2s, transform 0.1s;
      }

      .control-btn:hover {
        background: #1558b8;
        transform: translateY(-1px);
      }

      .control-btn:active {
        transform: translateY(0);
      }

      .bg-color-btn {
        background: #6c757d;
      }

      .bg-color-btn:hover {
        background: #5a6268;
      }

      .control-info {
        text-align: center;
        font-size: 10px;
        color: #888;
        padding-top: 2px;
      }
    `;
  }
}

// Register the custom element
customElements.define('nc-toolpath-plot', NCToolpathPlot);

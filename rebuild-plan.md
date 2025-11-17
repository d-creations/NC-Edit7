# NC-Edit7 Frontend Rebuild Plan

## 1. Project Goals
- Rebuild the multi-channel CNC editor UI using TypeScript, Web Components, ACE editor, and three.js only.
- Support configurable machine profiles with up to three synchronization channels.
- Provide tooling panels for keywords/synchronization codes, tool geometry offsets, variable lists, and executed NC code per channel.
- Display time gutter values beside each editor, highlight synchronization alignment, and surface CNC code errors clearly.
- Render toolpath plots via three.js with machine selection and server-driven geometry data.

## 2. Architecture Overview
- **Language & Tooling**: TypeScript (strict mode), Web Components, ACE editor, three.js and ESLint/Prettier configured for TypeScript.
- **Instantiation Service**: Central registry responsible for constructing and providing services/components. Avoid `new` scattered across modules; rely on dependency tokens and factory functions.
- **Module Structure**:
  - `src/core/` for shared types, interfaces, and the instantiation service.
  - `src/domain/` for NC parsing, toolpath models, machine profiles.
  - `src/services/` for parser service, state manager, backend gateway, event bus, and settings persistence.
  - `src/components/` for Web Components (layout, editor panes, control panels, plot viewer).
  - `src/adapters/` for ACE integration and three.js scene management.
  - `src/workers/` for heavy parsing/analysis tasks executed off the main thread.

## 3. Domain Modeling
- Define core interfaces:
  - `MachineProfile`: axes, feed limits, default tools, kinematics, available channels.
  - `ChannelId`, `ChannelState`, `ChannelTimeline`: track program lines, synchronization markers, timing data.
  - `ToolInfo`, `ToolGeometry`, `ToolUsage`: describe tool offsets and usage per channel.
  - `SyncEvent`: synchronization code line, channel references, timing offsets.
  - `NcParseResult`: tokens, errors, timing table, executed blocks, toolpath request payload.
  - `PlotRequest`, `PlotSegment`, `PlotResponse`: data contract with plotting server.
- Specify DTOs for server communication and error structures.

## 4. Server Interface Contracts
- **Endpoint**: CGI script at `scripts/cgiserver.cgi` behind web server (expects JSON POST, returns JSON).
- **Payload Shapes**:
   - Object with `machinedata` array `{ "machinedata": [ { program, machineName, canalNr }, ... ] }`.
   - Direct array `[ { program, machineName, canalNr }, ... ]`.
- **Required Fields**: `program` (string without `() { }` characters), `machineName` (one of SB12RG_F, FANUC_T, SR20JII_F, SB12RG_B, SR20JII_B, ISO_MILL), `canalNr` (string or number identifying synchronization channel).
- **Preprocessing**: Server strips parentheses comments, converts newlines to semicolons, removes spaces before execution.
- **Processing Flow**: Builds CNC states per machine, configures units, instantiates `StatefulIsoTurnNCControl`, and runs `NCExecutionEngine.get_Syncro_plot(programs, True)`.
- **Response**: `{ "canal": <engine_result>, "message": <message_stack> }` on success; error responses contain diagnostic keys (e.g., `message_TEST`).
- **Side Effects**: Optional MariaDB logging of request IP (`REMOTE_ADDR`) and truncated POST body when credentials available.
- **Machine Discovery**: POST `{ "action": "list_machines" }` (or `"get_machines"`) to receive `{ "machines": [ { machineName, controlType }, ... ] }`.
- **Client Responsibilities**: Avoid forbidden characters, supply newline-separated programs, handle diagnostic messages, and map `canal` data to plotting/visualization models.

## 5. Services & Instantiation
1. **ServiceRegistry** (instantiation service)
   - Registers constructors/factories keyed by symbols.
   - Supports singleton and scoped instantiation for components.
   - Handles lifecycle (init/dispose) hooks.
2. **EventBus**
   - Lightweight publish/subscribe for application-level events (state updates, errors, parser results).
3. **StateService**
   - Central store for machines, channels, documents, UI settings.
   - Provides immutable snapshots + event notifications on changes.
4. **MachineService**
   - Retrieves machine profiles, canal metadata, and plot points from the CGI server (`action=list_machines` and main `machinedata` response).
   - Normalizes server data into `MachineProfile` plus plot-ready `PlotPoint` bundles, caches responses, and exposes async getters to other services.
   - Emits machine change events so components can rebind editors, tool lists, and plots when a new profile arrives.
5. **ParserService**
   - Runs in a worker when available to parse NC source into `NcParseResult`.
   - Emits timing, error markers, synchronization metadata.
6. **BackendGateway**
   - Wraps fetch calls to plotting server; handles retries, cancellation, and mapping into `PlotResponse`.
7. **PlotService**
   - Converts parser output into three.js scene elements; caches segments per machine/channel.
8. **UserPreferenceService**
   - Stores layout preferences, active machine, channel toggles in local storage.
9. **CommandService**
   - Centralized commands (e.g., `alignSync`, `toggleChannel`, `requestPlot`).
10. **DiagnosticsService**
   - Aggregates parser errors, backend errors, and surfacing guidelines for the UI.

## 6. Web Components
- **Root Component** `<nc-editor-app>`
  - Bootstraps ServiceRegistry, loads initial machine profile, orchestrates layout.
  - Contains panels: channel switcher, left tool/sync list, channel container, plot area, status bar.
- **Channel Container** `<nc-channel-pane>`
  - Renders one channel’s editor view, tool list, variable list, executed code list.
  - Receives channel state via attributes/properties; subscribes to state changes via EventBus.
- **ACE Wrapper** `<nc-code-pane>`
  - Encapsulates ACE instantiation, binding to ParserService for markers/time gutter.
  - Emits events for selection changes, scroll sync, command triggers.
- **Tool List** `<nc-tool-list>`
  - Displays tool geometry offsets and status; updates when ParserService reports changes.
- **Variable List** `<nc-variable-list>`
  - Shows NC variables/registers per channel.
- **Executed Code** `<nc-executed-list>`
  - Maintains executed code history; integrates with ParserService timeline.
- **Sync Panel** `<nc-sync-controls>`
  - Buttons/switches to align synchronization, show/hide channels, adjust timeline.
- **Keyword Panel** `<nc-keyword-panel>`
  - Left-side list of tools/sync codes; clicking filters or jumps editors.
- **Time Gutter Renderer**
  - Custom ACE gutter showing cycle times; ties into ParserService results.
- **Plot Viewer** `<nc-toolpath-plot>`
  - Owns three.js scene, interacts with PlotService for geometry updates.
- **Status Indicator** `<nc-status-indicator>`
  - Displays summary of errors/warnings; receives data from DiagnosticsService.
- **Machine Selector** `<nc-machine-selector>`
  - Dropdown to switch machines, triggers state updates and reparse.

## 7. ACE Editor Customization
- Load ACE modules via dynamic imports inside `<nc-code-pane>`.
- Configure session per channel with custom NC mode (syntax highlighting, line tokens).
- Implement custom gutter renderer for time values via `session.gutterRenderer`.
- Add markers for sync lines (`session.addMarker`), executed code (`addDynamicMarker`), and errors (`setAnnotations`).
- Implement synchronized scrolling between channels as needed via shared events.
- Provide commands (keyboard shortcuts) for toggling channel visibility, aligning sync, jumping to errors.

## 8. Three.js Plot Integration
- Initialize three.js (scene, camera, lights) in `<nc-toolpath-plot>`.
- Load machine-specific geometry (e.g., chuck, turret) based on `MachineProfile`.
- Convert `PlotResponse` segments into `BufferGeometry` lines and tool markers.
- Provide controls for playback speed, zoom/pan, and toggling channel overlays.
- Highlight current execution line by mapping ParserService timeline to plot animation.

## 9. Workflow & Data Flow
1. User selects machine/channels → `StateService` updates configuration.
2. User loads NC program → `ParserService` processes text, returns `NcParseResult`.
3. `StateService` updates channel states, tool lists, time gutter data, errors.
4. UI components react to state events and re-render as needed.
5. Plot request triggered with `PlotRequest` derived from `NcParseResult` → `BackendGateway` fetches plot → `PlotService` feeds `<nc-toolpath-plot>`.
6. Synchronization controls adjust state/timeline; ACE panes react via markers.

## 10. Implementation Phases
1. **Setup & Tooling**
   - Configure TypeScript project, bundler, test runner, linting, and basic index page with custom elements polyfill if needed.
   - Implement ServiceRegistry scaffolding and core type definitions.
2. **Parser & State Foundations**
   - Port/implement NC parsing logic, timing calculations, error detection.
   - Implement StateService, EventBus, and initial ParserService integration (no UI yet).
3. **Web Component Shell**
   - Build `<nc-editor-app>` with layout placeholders; wire machine selector and channel switching.
4. **ACE Integration**
   - Develop `<nc-code-pane>` with time gutter and basic markers; hook to ParserService outputs.
5. **Channel Panels**
   - Implement tool list, variable list, executed code components; connect to state updates.
6. **Keyword & Sync Controls**
   - Build left panel for tools/sync keywords; implement synchronization alignment commands.
7. **Three.js Plot**
   - Implement `<nc-toolpath-plot>` and PlotService; connect to backend requests.
   - Add animation playback aligned with ACE selection/timeline.
8. **Diagnostics & UX Polishing**
   - Integrate status indicator, error overlays, loading states, and channel alignment UI.
   - Ensure responsive layout and accessibility (keyboard navigation, ARIA labels).
9. **Testing & Stabilization**
   - Add unit tests for services, integration tests for key interactions.
   - Profile performance with large NC programs; optimize parsing/plotting hotspots.
10. **Documentation & Packaging**
    - Document architecture, service contracts, component APIs, and build/deployment instructions.
    - Prepare release bundle and deployment scripts.

## 11. Deliverables Checklist
- [ ] TypeScript project scaffold with ServiceRegistry and core interfaces.
- [ ] ParserService producing timing, sync events, errors, tool usage.
- [ ] Event-driven StateService with worker integration.
- [ ] Web Component suite for editor layout, channels, and controls.
- [ ] ACE integration with time gutter, markers, and error annotations.
- [ ] Three.js plot component tied to backend requests and channel timeline.
- [ ] Diagnostics and status reporting UI.
- [ ] Automated tests and documentation.

## 12. Open Questions
- Confirm available backend endpoints for plot requests (authentication, payload format, response latency expectations).
- Validate performance requirements (max file size, target FPS for plotting, acceptable parse latency).
- Determine localization needs for UI labels and measurement units.
- Establish how machine profiles are provided (static JSON, server request, user upload).

# NC-Edit7 Frontend Rebuild Plan

## 1. Project Goals
- Rebuild the multi-channel CNC editor UI using TypeScript, Web Components, ACE editor, and three.js only.
- Support configurable machine profiles with up to three synchronization channels, each instanced as a detachable “channel component” that can be activated/deactivated from the task list.
- Provide tooling panels per channel for keywords/synchronization codes, tool geometry offsets, variable lists (registers 1–999), executed NC code, and machine selection (channel scoped or global) with data retrieved from `ncplot7py/scripts/cgiserver.cgi`.
- Display a toggleable time gutter on the left or right of each ACE editor, highlight synchronization alignment, and surface CNC code errors clearly.
- Keep keyword lists in sync with parser output so clicking a keyword scrolls the editor to the correct line.
- Offer a tab bar per channel for switching between the program input editor and the executed program returned by the backend.
- Render toolpath plots via three.js with machine selection and server-provided point clouds, aligning the animation timeline with editor focus.

## 2. Architecture Overview
- **Language & Tooling**: TypeScript (strict mode), Web Components, ACE editor, three.js and ESLint/Prettier configured for TypeScript.
catch error in the console and try to catch stacking endless loops and catch if the server is not online
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
   - `ToolRegisterEntry`: derived from parser results, storing tool number plus Q/R parameters for quick lookup in the UI drawers.
  - `SyncEvent`: synchronization code line, channel references, timing offsets.
   - `NcParseResult`: minimal fault-detection contract `{ faultDetected: boolean, faults?: FaultDetail[] }` used to flag syntax/runtime issues discovered locally.
   - `ParseArtifacts`: supplemental data bundle `{ keywords, variableSnapshot, toolRegisters, timingMetadata }` produced alongside `NcParseResult` for UI rendering.
   - `ExecutedProgramResult`: returned from the server-side parser; includes executed line numbers, updated variable register snapshots, per-line execution time, and associated plot metadata.
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
5. **ParserService (Browser)**
   - Runs in a worker (client-side) to parse NC source into `NcParseResult` (fault detected vs not).
   - Emits `ParseArtifacts` that include synchronization metadata, keyword tables, variable register (1–999) snapshots, and tool register entries and add the  Q/R parameters for each tool in the tool list.
6. **ExecutedProgramService (Server Parser)**
   - Invoked when the user requests execution results; posts program(s) to the CGI endpoint.
   - Receives executed line numbers, updated variable/parameter values, per-line execution time, and plot points; feeds data into channel tab bars and the plot service.
7. **BackendGateway**
   - Wraps fetch calls to plotting server; handles retries, cancellation, and mapping into `PlotResponse`.
8. **PlotService**
   - Converts parser output into three.js scene elements; caches segments per machine/channel.
9. **UserPreferenceService**
   - Stores layout preferences, active machine, channel toggles in local storage.
10. **CommandService**
   - Centralized commands (e.g., `alignSync`, `toggleChannel`, `requestPlot`).
11. **DiagnosticsService**
   - Aggregates parser errors, backend errors, and surfacing guidelines for the UI.

## 6. Web Components
- **Root Component** `<nc-editor-app>`
  - Bootstraps ServiceRegistry, loads initial machine profile, orchestrates layout.
   - Contains panels: channel switcher, machine selector, channel container grid (up to three instances), plot area, status bar, and a top task list for enabling/disabling channels.
- **Channel Container** `<nc-channel-pane>`
   - Renders one channel’s editor view, keyword list, tab bar, variable list drawer, and executed code pane.
   - Accepts layout prefs so keyword list + time gutter can dock left/right, and emits events when gutters or drawers are toggled.
- **ACE Wrapper** `<nc-code-pane>`
  - Encapsulates ACE instantiation, binding to ParserService for markers/time gutter.
  - Emits events for selection changes, scroll sync, command triggers.
   
- **Tool List** `<nc-tool-list>`
  - Displays tool geometry offsets and status; updates when ParserService reports changes.
   - Provides “overlay” mode so the drawer can float above the editor when opened from below.
- **Variable List** `<nc-variable-list>`
   - Shows NC variables/registers 1–999 per channel; includes lazy rendering, filtering, and highlights updated registers returned from server execution results.
- **Executed Code** `<nc-executed-list>`
   - Maintains executed code history; integrates with ParserService timeline and uses server-provided executed line numbers to display runtime order.
- **Sync Panel** `<nc-sync-controls>`
  - Buttons/switches to align synchronization, show/hide channels, adjust timeline.
- **Keyword Panel** `<nc-keyword-panel>`
   - Auto-updates keywords/sync codes from ParserService; clicking jumps ACE to the matching line and highlights it.
- **Time Gutter Renderer**
   - Custom ACE gutter showing cycle times; ties into ParserService results and can be positioned left/right per channel.
- **Plot Viewer** `<nc-toolpath-plot>`
  - Owns three.js scene, interacts with PlotService for geometry updates.
- **Status Indicator** `<nc-status-indicator>`
  - Displays summary of errors/warnings; receives data from DiagnosticsService.
- **Machine Selector** `<nc-machine-selector>`
   - Retrieves available CNC machines from the CGI server, supports “apply to all channels” and per-channel overrides.

## 7. Channel UX Requirements
- Channel components must expose toggles for: keyword list side, time gutter side, variable list drawer, tool offset overlay, and executed-program tab.
- The top task list controls which channels (1–3) are active; inactive channels free layout space and release ACE resources.
- Variable list drawers slide from beneath the editor, can be resized, default to closed, and show both browser-parsed values plus server-returned deltas (highlighted) after execution.
- Tool geometry overlays can float over the editor, dimming the ACE session to keep focus on offsets.
- Keyword lists refresh automatically when parser results change and keep the last clicked keyword highlighted until the caret moves.
- Tab bars per channel show “Program” vs “Executed” states, with server timestamps for the executed plan.
- Machine selectors reflect whether a channel inherits the global machine or a dedicated override; when synchronized, a single change updates all active channels.

## 8. ACE Editor Customization
- Load ACE modules via dynamic imports inside `<nc-code-pane>`.
- Configure session per channel with custom NC mode (syntax highlighting, line tokens).
- Implement custom gutter renderer for time values via `session.gutterRenderer`.
- Add markers for sync lines (`session.addMarker`), executed code (`addDynamicMarker`), and errors (`setAnnotations`).
- Implement synchronized scrolling between channels as needed via shared events.
- Provide commands (keyboard shortcuts) for toggling channel visibility, aligning sync, jumping to errors.
- When the executed tab is active, load the server-returned executed code into a read-only ACE session, overlaying execution timestamps and matching plot frames.

## 9. Three.js Plot Integration
- Initialize three.js (scene, camera, lights) in `<nc-toolpath-plot>`.
- Load machine-specific geometry (e.g., chuck, turret) based on `MachineProfile`.
- Convert `PlotResponse` segments into `BufferGeometry` lines and tool markers.
- Provide controls for playback speed, zoom/pan, and toggling channel overlays.
- Highlight current execution line by mapping ParserService timeline to plot animation.
 - Accept plot point payloads returned alongside executed program data to keep channel views synchronized with the 3D scene.
 open and close the plot by a toggle in the UI make the width resizeable

## 10. Workflow & Data Flow
1. User selects machine/channels → `StateService` updates configuration.
2. User toggles channel visibility/task list entries → inactive channels dispose components; active channels boot watchers and request machine data.
3. User loads NC program → client-side `ParserService` processes text in-browser, returning `NcParseResult` (fault detected vs not) plus `ParseArtifacts` (keyword table, variable & tool register snapshot with Q/R parameters, and timing metadata).
4. `StateService` updates channel states, tool lists, time gutter data, keyword lists, and errors; keyword panels auto-refresh highlights.
5. UI components react to state events: ACE panes update gutters, variable drawers display registers (1–999), and tool overlays show Q/R parameters immediately.
6. User clicks “Execute”/plot request → `ExecutedProgramService` posts source to the server parser; response contains executed line numbers, updated variable register, per-line execution time, and plot data.
7. `StateService` merges server execution results: channel tab bars populate executed sessions, variable drawers highlight deltas, and plot service updates three.js scenes.
8. Synchronization controls adjust state/timeline; ACE panes react via markers and align with the updated three.js animation.
9. Machine selector changes propagate either globally or per channel, triggering re-parse and (if needed) re-execution for server data.

## 11. Implementation Phases
1. **Setup & Tooling**
   - Configure TypeScript project, bundler, test runner, linting, and basic index page with custom elements polyfill if needed.
   - Implement ServiceRegistry scaffolding and core type definitions.
2. **Parser & State Foundations**
   - Port/implement NC parsing logic, timing calculations, error detection.
   - Implement StateService, EventBus, and initial client-side ParserService integration (no UI yet); ensure `NcParseResult` (fault detection) and `ParseArtifacts` (keywords, variable registers, tool registers, timing) are emitted.
3. **Web Component Shell**
   - Build `<nc-editor-app>` with layout placeholders; wire machine selector, top channel task list, and activate/deactivate workflows for up to three channels.
4. **ACE Integration**
   - Develop `<nc-code-pane>` with time gutter toggles (left/right) and basic markers; hook to ParserService outputs.
   - Implement tab bar logic so each channel can swap between “Program” and “Executed” ACE sessions seamlessly.
5. **Channel Panels**
   - Implement keyword panels with auto-refresh, variable drawers (1–999 registers), tool offset overlays, and executed code tabs; connect to state updates.
6. **Keyword & Sync Controls**
   - Build left panel for tools/sync keywords; implement synchronization alignment commands.
   - Ensure keyword clicks scroll to lines using ACE API and highlight the row until caret moves.
7. **Three.js Plot**
   - Implement `<nc-toolpath-plot>` and PlotService; connect to backend requests.
   - Add animation playback aligned with ACE selection/timeline and multiple channel overlays.
8. **Executed Program Flow**
   - Implement `ExecutedProgramService`, server fetch logic, executed ACE sessions, variable delta highlighting, and timeline merging with plot updates.
8. **Diagnostics & UX Polishing**
   - Integrate status indicator, error overlays, loading states, and channel alignment UI.
   - Ensure responsive layout and accessibility (keyboard navigation, ARIA labels).
9. **Testing & Stabilization**
   - Add unit tests for services, integration tests for key interactions.
   - Profile performance with large NC programs; optimize parsing/plotting hotspots.
10. **Documentation & Packaging**
    - Document architecture, service contracts, component APIs, and build/deployment instructions.
    - Prepare release bundle and deployment scripts.

## 12. Deliverables Checklist
- [ ] TypeScript project scaffold with ServiceRegistry and core interfaces.
- [ ] ParserService producing `NcParseResult` (fault detection) plus `ParseArtifacts` (timing, sync events, keywords, variable/tool registers).
- [ ] Event-driven StateService with worker integration.
- [ ] Web Component suite for editor layout, channels, and controls, including keyword panels, variable drawers, and tool overlays.
- [ ] ACE integration with time gutter, markers, tab bar, and error annotations.
- [ ] Three.js plot component tied to backend requests, executed program tabs, and channel timeline.
- [ ] ExecutedProgramService returning executed line numbers, variable deltas, per-line execution time, and plot metadata.
- [ ] Diagnostics and status reporting UI.
- [ ] Automated tests and documentation.

## 13. Open Questions
- Confirm available backend endpoints for plot requests (authentication, payload format, response latency expectations).
- Validate performance requirements (max file size, target FPS for plotting, acceptable parse latency).
- Determine localization needs for UI labels and measurement units.
- Establish how machine profiles are provided (static JSON, server request, user upload).
- Clarify how machine selection should behave when both global and per-channel overrides are set simultaneously (precedence, default state).
- Confirm frequency for keyword list auto-refresh (per keystroke vs debounced parse results) to balance responsiveness and performance.
- Define UX for overlapping tool geometry drawer (modal vs overlay) and whether it should pause editor input while open.

## 14. Server Deployment & CGI Setup
- **Apache role**: host static frontend assets and proxy CGI calls to the Python backend. Enable `mod_cgi`/`mod_proxy_fcgi` (depending on the distribution) so that `.cgi` scripts under `ncplot7py/scripts/` execute through `/usr/bin/env python3` rather than being served as plain files.
- **Script placement & permissions**: keep `ncplot7py/scripts/cgiserver.cgi` executable (`chmod 755`) and owned by the web user. A `ScriptAlias` or `<Directory>` block should point to that directory, e.g. `ScriptAlias /cgi-bin/ /var/www/NC-Edit7Pro/ncplot7py/scripts/` with `AddHandler cgi-script .cgi` and `Options +ExecCGI`. Add `AllowOverride None` and `Require all granted` to avoid additional authentication walls.
- **Environment wiring**: set `CGI_DB_USER`, `CGI_DB_PASSWORD`, `CGI_DB_HOST`, `CGI_DB_PORT`, and `CGI_DB_DATABASE` (or the legacy `NCLOG_*` equivalents) via `SetEnv` in Apache or a dedicated env file sourced by `PassEnv`. When logging is not needed, leave these undefined so the script bypasses MariaDB access. Pass `REMOTE_ADDR` through as normal so audits keep the originating client.
- **Dependency management**: install the Python dependencies listed in `ncplot7py/dev-requirements.txt` (at least `mariadb` and any parser/runtime packages) into the interpreter Apache runs. Point `mod_cgi` to the same virtualenv by adjusting the shebang (`#!/usr/bin/env python3`) and ensuring `/usr/bin/env python3` resolves to the intended runtime.
- **Health & monitoring**: tail Apache logs (`access.log` + `error.log`) for CGI failures (e.g., permission errors or JSON parsing exceptions) and capture the `message_T`/`program` payload returned on error. Optionally configure `LogFormat`/`CustomLog` per virtual host to include `%a` for client IP so it aligns with the script’s internal logging and to monitor request sizes.
- **Frontend routing**: proxy or redirect `fetch` calls from the client to `/cgi-bin/cgiserver.cgi`; ensure CORS headers are set if the frontend is served from another host, and keep the endpoint path consistent with the runtime `fetch` URLs used in `src/services/BackendGateway.ts` (or similar modules).
- **Artifact sync**: the `dist/ncplot7py` tree must mirror `ncplot7py/` so that built deployments include the same CGI script and helpers; use the existing copy helper (e.g., run `npm run copy-ncplot7py` before packaging) any time the script changes so Apache serves the new logic.

# NC Panel Integration Overview

## Current architecture

### Frontend composition

- `NCEditorApp` is the root shell for the main application.
- `NCEditorApp` owns the desktop side panel that currently switches between `nc-toolpath-plot` and `nc-focas-transfer`.
- `NCChannelPane` owns one channel view and embeds `nc-bottom-panel` directly below `nc-code-pane`.
- `NCBottomPanel` is currently a self-contained drawer with only two tabs: Variables and Errors.
- `NCFocasTransfer` is a separate reusable web component for CNC transfer and FOCAS operations.

### Plot flow

- The channel Plot button in `NCChannelPane` publishes `plot:request` and forces `plotViewerOpen=true`.
- `NCEditorApp` listens for `plot:request` and opens the desktop plot side panel.
- `NCToolpathPlot` also listens for `plot:request`, executes plotting through `ExecutedProgramService`, and renders the result.
- `ExecutedProgramService` sends a plot request through `BackendGateway` to the Python backend and publishes `execution:completed`.

### Backend and FOCAS flow

- `BackendGateway` is the single frontend boundary for both CGI plotting and FOCAS REST calls.
- `backend/main.py` exposes `/cgiserver_import` for plot execution and `/api/focas/*` for machine transfer.
- `backend/focas_service.py` hides the real-vs-mock FOCAS implementation behind `get_focas_client()`.
- The real FOCAS boundary is below the FastAPI layer, so the UI does not need DLL knowledge.

### VS Code host integration

- `src/main.ts` already supports host-specific startup through injected config and `window.isFocasPanel`.
- The VS Code extension contributes a bottom panel container through `package.json` and registers `FocasWebviewViewProvider`.
- The provider injects `backendPort`, `focasDefaultIp`, and `window.isFocasPanel=true`, then boots only `nc-focas-transfer`.

## What is structurally good already

- Service boundaries are mostly clean: UI -> `BackendGateway` -> FastAPI -> FOCAS service.
- FOCAS logic is already isolated in `NCFocasTransfer`, which makes host reuse feasible.
- Plot opening is event-driven, so the main view can force the plot panel open without tight coupling to the plot component.
- Config strategy already exists for Web vs VS Code via `WebConfigService` and `VsCodeConfigService`.

## Current architectural problems

### 1. Bottom panel content is not modular enough

`NCBottomPanel` hardcodes its own tabs and inner content. That means you cannot reuse the same panel content inside a VS Code bottom panel without moving or duplicating its internals.

### 2. FOCAS is presented in multiple places with overlapping responsibility

Today FOCAS appears in:

- the desktop side panel tab inside `NCEditorApp`
- the separate VS Code contributed panel via `FocasWebviewViewProvider`

That is acceptable only if one is the canonical host and the other is optional. Right now the ownership is not explicit.

### 3. There is stale layout structure in `NCEditorApp`

`NCEditorApp` still renders `app-focas-container`, but the current interaction path switches the side panel tab instead of using that container. That makes the layout harder to reason about and increases the risk of accidental divergence.

### 4. Host selection is too coarse

The app can currently switch between:

- full editor app
- standalone FOCAS panel

It cannot yet switch between different bottom-panel compositions like:

- web channel bottom drawer
- VS Code contributed bottom panel using the same inner modules
- no embedded FOCAS in the main editor because VS Code hosts it separately

## Recommended target architecture

### Principle

Keep container/layout decisions host-specific, but keep panel content modules host-agnostic.

### Split the current responsibilities into three layers

#### 1. Panel content modules

Create small reusable components that render only content, not placement.

Suggested components:

- `nc-variables-panel-content`
- `nc-errors-panel-content`
- `nc-focas-panel-content` or reuse `nc-focas-transfer` directly
- optional later: `nc-execution-panel-content`

These components should not decide whether they live:

- inside `NCBottomPanel`
- inside the desktop right-side tools panel
- inside a VS Code contributed panel webview

#### 2. Panel container modules

Use host-specific containers to arrange those content modules.

Suggested containers:

- `NCBottomPanel` for the web page and in-editor channel layout
- `NCEditorSidePanel` for the plot/FOCAS side panel inside the full app shell
- a new VS Code panel root such as `NCWorkbenchPanelApp` for contributed bottom-panel webviews

#### 3. Host policy/config

Add a config-driven layout policy so the host decides where FOCAS and other panel content live.

Suggested config shape:

```json
{
  "hostMode": "web" | "vscode-editor" | "vscode-panel",
  "focasPlacement": "side-panel" | "bottom-panel" | "external-panel" | "disabled",
  "bottomPanelTabs": ["variables", "errors"],
  "workbenchPanelTabs": ["variables", "errors", "focas"],
  "plotPlacement": "side-panel"
}
```

This does not need to live in `package.json` alone. The better design is:

- extension `package.json` contributes the VS Code panel container/view
- the webview/provider injects runtime layout config
- frontend config services consume that runtime config

## Recommended integration direction for your goal

Your goal is:

- on the webpage, keep the current bottom panel behavior
- in VS Code, show the bottom-panel internals in the workbench bottom panel
- keep plot access reliable when the user clicks Plot from the main view

The cleanest path is:

### Web page

- Keep `NCChannelPane -> NCBottomPanel` as it is conceptually.
- Refactor `NCBottomPanel` so it hosts reusable content components instead of owning all markup directly.

### VS Code custom editor

- Keep the main editor surface focused on channels plus the plot side panel.
- Remove embedded FOCAS from the main editor side panel when VS Code is hosting FOCAS elsewhere.
- Keep `plot:request` behavior unchanged so clicking Plot in the main view still opens the plot side panel immediately.

### VS Code workbench bottom panel

- Create a dedicated bottom-panel webview that hosts selected bottom-panel content modules.
- Start with Variables, Errors, and FOCAS as tabs in that panel.
- Do not make plotting depend on this workbench panel being visible.

That last point is important: the workbench bottom panel should be supplementary UI, not a required step in the plot execution path.

## Concrete plan

### Phase 1: Separate reusable panel content

1. Extract the contents of `NCBottomPanel` into reusable components for Variables and Errors.
2. Keep `NCBottomPanel` as a drawer shell that simply arranges those extracted components.
3. Treat `NCFocasTransfer` as the reusable FOCAS content module.

Expected outcome:

- one content implementation
- multiple host containers

### Phase 2: Introduce layout policy

1. Extend `AppConfiguration` with layout settings for host mode and panel placement.
2. Inject those settings from the VS Code provider into the webview.
3. Let `NCEditorApp` decide whether to show FOCAS inside the side panel based on config.

Expected outcome:

- webpage keeps current layout
- VS Code can disable duplicated embedded FOCAS

### Phase 3: Add a modular VS Code workbench panel app

1. Add a new panel root component for the contributed bottom panel.
2. Reuse the extracted Variables/Errors/FOCAS content modules inside that host.
3. Register this panel from the extension provider with runtime config.

Expected outcome:

- VS Code workbench panel shows bottom-panel internals
- no duplication of inner business UI

### Phase 4: Simplify current FOCAS placement

1. Choose one canonical FOCAS location per host.
2. In VS Code, prefer the contributed workbench panel for FOCAS.
3. In web mode, keep FOCAS in the existing side panel unless you want a later redesign.
4. Remove the stale `app-focas-container` branch if it remains unused.

Expected outcome:

- simpler ownership
- less UI duplication

## Rules for plot integration

These should remain true after refactor:

1. Clicking Plot in `NCChannelPane` must work even if the workbench bottom panel is closed.
2. Plot execution must continue to be triggered through `plot:request` and `ExecutedProgramService`.
3. The workbench bottom panel must not be a runtime dependency for plot rendering.
4. The plot side panel should remain the canonical place for plot visualization.

## Minimal implementation recommendation

If you want the least risky implementation sequence, do this first:

1. Extract `NCBottomPanel` internals into reusable content components.
2. Add layout config for `focasPlacement`.
3. In VS Code, set `focasPlacement=external-panel`.
4. Build a new workbench panel app that reuses those content components.
5. Remove duplicated or stale FOCAS containers from `NCEditorApp`.

This sequence avoids breaking plot execution while making the UI modular.

## Main decisions to make before coding

1. Should Variables and Errors in the VS Code bottom panel be global, or channel-specific with a channel switcher?
2. Should FOCAS live only in the VS Code workbench panel, or also remain in the editor side panel there?
3. Should the VS Code workbench panel be a single composite panel with tabs, or separate views for Variables, Errors, and FOCAS?

My recommendation:

- keep plot in the editor side panel
- move FOCAS to the VS Code workbench panel only
- put Variables and Errors in the same workbench panel as tabs
- keep the web page layout unchanged
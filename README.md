# NC-Edit7
CNC NC code editor view with plot interface. 

The editor integrates the ACE text editor and enables the plotting of toolpaths with the three.js library

It is currently developed as a gui for an nc-code plot 

this script rebuilds the project and then executes `node --test test/parser.service.test.js test/state.service.test.js`, which loads those files from the `test` directory and reports any failures from the services under test. The parser test now covers sync/tool detection, parse completion emission, and empty-program handling, while the state test validates timeline length and cached channel states. `npm test` also runs `test/app-context.test.js`, `test/eventBus.test.js`, and `test/code-pane-renderer.test.js` so the shared services and DOM-free renderer stay verified.
but a beta view is already available

### beta view
you will find a beta view under https://www.star-ncplot.com


<img src="./image.png" width="200px">

## Local build

To rebuild the TypeScript source, install the tooling and run the clean/build scripts:

## Phase 5 demo panels

The `nc-editor-app` demo now renders `<nc-code-pane>` next to three new information panels. `<nc-tool-list>` shows tool numbers and the lines where they appear, `<nc-variable-list>` surfaces NC variables/registers with their most recent line references, and `<nc-executed-list>` keeps the last few timeline entries so you can trace execution progress. All panels consume the same `ChannelState` emitted via `EventBus`, so typing or pasting a program and clicking “Parse channel” updates every panel simultaneously.
```bash
npm install
npm run clean
npm run build
```

The build emits compiled files under `dist` and relies solely on Node 16+ native APIs (no `rimraf`).

## Testing

Phase 2 tests verify the parser and state services using Node's built-in test runner. They rely on the up-to-date `dist` output, so run them via:

```bash
npm run test
```

This script rebuilds the project and then executes `node --test test/parser.service.test.js test/state.service.test.js`, which loads those files from the `test` directory and reports any failures from the services under test. The parser test now covers sync/tool detection, parse completion emission, and empty-program handling, while the state test validates timeline length and cached channel states.

## Phase 3 preview

The new `<nc-editor-app>` web component wires the parser and state services into a simple UI shell with a program editor on the left and a `<nc-channel-panel>` on the right that summarizes parsed state, tools, and errors. To try it manually:

1. Build the project (`npm run build`).
2. Include the compiled bundle (e.g., `<script type="module" src="dist/index.js"></script>`) on a page.
3. Drop `<nc-editor-app></nc-editor-app>` into the HTML body and type or paste an NC program to see the services in action.

## Phase 4 prototype

`<nc-code-pane>` now complements the channel panel by rendering the parsed NC lines, highlighting error rows, and surfacing line/error counts plus the most recent parse timestamp so ACE integration has a visual target. After building, load `dist/index.js` and the component will paint the latest parse whenever `channelUpdated` fires.

## Demo page

You can preview the current shell at `index.html` after running `npm run build`. The page loads `<nc-editor-app>` from `dist/index.js`, so any changes to the app or components will appear once the build completes.


# NC-Edit7 Development Guide

## Project Overview

NC-Edit7 is a multi-channel CNC NC code editor with plot interface, built with TypeScript, Web Components, ACE editor, and three.js. The project follows the comprehensive architecture outlined in `build-plan.md`.

## Architecture

The application is organized into the following structure:

```
src/
├── core/           # Core types, interfaces, and ServiceRegistry
├── domain/         # Domain models and business logic
├── services/       # Application services (State, Parser, Machine, etc.)
├── components/     # Web Components for UI
├── adapters/       # Integrations (ACE editor, three.js)
└── workers/        # Web Workers for heavy processing
```

## Key Technologies

- **TypeScript**: Strict mode for type safety
- **Web Components**: Custom elements for UI components
- **Vite**: Fast build tool and dev server
- **ACE Editor**: Code editing with custom gutters and markers
- **three.js**: 3D toolpath visualization
- **ESLint + Prettier**: Code quality and formatting

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Modern web browser with Web Components support

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts the Vite dev server at http://localhost:3000 with hot module reloading.

### Building

```bash
npm run build
```

This compiles TypeScript, bundles with Vite, and copies the ncplot7py directory to dist.

### Code Quality

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Testing

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui
```

## Service Architecture

The application uses a ServiceRegistry for dependency injection:

- **EventBus**: Publish/subscribe for application events
- **StateService**: Central state management for channels, machines, and UI
- **MachineService**: Machine profile management and server communication
- **ParserService**: Client-side NC code parsing (with Web Worker support)
- **BackendGateway**: Server communication with retry logic

## Web Components

- **nc-editor-app**: Root application component
- Additional components will be added for:
  - Channel panes
  - Code editors
  - Tool lists
  - Variable displays
  - Plot viewer
  - Keyword panels

## Server Integration

The application communicates with a Python CGI backend at `/cgi-bin/cgiserver.cgi`:

- Machine list retrieval
- NC program execution
- Plot data generation

See `build-plan.md` section 4 for detailed server contracts.

## Build Output

The `dist/` directory contains:
- `index.html`: Main entry point
- `assets/`: Bundled JavaScript and maps
- `ncplot7py/`: Python backend scripts (copied from source)
- `web.config`: IIS configuration
- `staticwebapp.config.json`: Azure Static Web Apps configuration

## Deployment

The built application can be deployed to:
- Apache with mod_cgi for Python backend
- IIS with CGI support
- Azure Static Web Apps
- Any static hosting with proxy to Python backend

## Contributing

1. Follow the TypeScript strict mode guidelines
2. Use the ServiceRegistry for dependency management
3. Maintain Web Components best practices
4. Keep components focused and reusable
5. Add tests for new functionality
6. Run linting before committing





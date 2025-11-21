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

## Next Steps

See `build-plan.md` for the complete implementation roadmap including:
- ACE editor integration with custom gutters
- three.js plot visualization
- Channel management UI
- Variable and tool displays
- Server execution flow

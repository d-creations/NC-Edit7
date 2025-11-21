# Cloud Agent Delegation

## Overview
This document describes the cloud agent delegation strategy for the NC-Edit7 project.

## Purpose
Cloud agents are specialized AI agents that can handle specific tasks more effectively than general-purpose assistants. This project is designed to leverage cloud agents for:

1. **Parser Development**: Complex NC code parsing logic
2. **Three.js Integration**: 3D visualization and toolpath rendering
3. **Backend Integration**: CGI server communication and data transformation
4. **Testing**: Automated test generation and validation

## CloudAgentService Implementation
The NC-Edit7 application includes a `CloudAgentService` that:
- Manages communication with cloud-based AI agents
- Routes parsing and analysis tasks to specialized agents
- Provides fallback mechanisms when cloud agents are unavailable
- Caches results for performance optimization

## Configuration
Cloud agent delegation can be configured via:
```typescript
{
  enabled: boolean,        // Enable/disable cloud agent delegation
  autoDelegate: boolean,   // Automatically delegate eligible tasks
  endpoint: string,        // Cloud agent API endpoint
  timeout: number         // Request timeout in milliseconds
}
```

## Integration Points
The CloudAgentService is integrated with:
- **ParserService**: Delegates complex parsing tasks
- **ExecutedProgramService**: Delegates program execution analysis
- **DiagnosticsService**: Delegates error detection and analysis

## Current Status
- ✅ CloudAgentService interface defined
- ✅ Service registration in dependency injection container
- ✅ Integration points identified
- ⏳ Cloud agent endpoint configuration pending
- ⏳ Agent-specific protocols to be defined

## Next Steps
1. Define cloud agent API contracts
2. Implement agent selection logic
3. Add retry and fallback mechanisms
4. Create monitoring and logging for agent interactions
5. Document agent-specific capabilities and requirements

## Related Files
- `dist/assets/index-ITj66DDk.js` - Compiled application including CloudAgentService
- `rebuild-plan.md` - Overall project rebuild plan
- `copilot_instruction.md` - Development guidelines

# CloudAgentService Documentation

## Overview

The `CloudAgentService` provides intelligent delegation of heavy computational tasks to cloud-based processing services. It automatically analyzes program characteristics and determines when cloud processing would be more efficient than local processing.

## Features

- **Intelligent Delegation**: Automatically decides when to delegate based on:
  - Program size (bytes)
  - Line count
  - Complexity score (calculated from G-codes, tool changes, sync codes, etc.)
  - Multi-channel execution scenarios

- **Capability Management**: Supports multiple processing capabilities:
  - Parsing: NC code parsing and analysis
  - Execution: Program execution and simulation
  - Plotting: Toolpath visualization data generation
  - Optimization: Code optimization (future)
  - Simulation: Advanced simulation (future)

- **Statistics Tracking**: Monitors delegation performance:
  - Local vs cloud task counts
  - Delegation success rate
  - Failed delegation tracking

- **Graceful Fallback**: Automatically falls back to local processing when cloud delegation fails

## Configuration

```typescript
const config: CloudAgentConfig = {
  enabled: true,               // Enable/disable cloud delegation
  endpoint: 'https://api...',  // Cloud service endpoint (optional)
  apiKey: 'your-api-key',      // API authentication key (optional)
  autoDelegate: true,           // Automatically delegate when thresholds are met
  thresholds: {
    programSizeBytes: 10000,   // Delegate if program exceeds 10KB
    lineCount: 500,             // Delegate if program exceeds 500 lines
    complexity: 70,             // Delegate if complexity score exceeds 70/100
  },
  capabilities: {
    parsing: true,
    execution: true,
    plotting: true,
    optimization: false,
    simulation: false,
  },
  timeout: 30000,              // Request timeout in milliseconds
};
```

## Usage

### Integration with ParserService

The `ParserService` automatically consults `CloudAgentService` before parsing:

```typescript
const parserService = new ParserService(eventBus, cloudAgentService);

// Parse will automatically delegate to cloud if appropriate
const { result, artifacts } = await parserService.parse(channelId, program);
```

### Integration with ExecutedProgramService

The `ExecutedProgramService` checks with `CloudAgentService` before execution:

```typescript
const executedProgramService = new ExecutedProgramService(
  backendGateway,
  stateService,
  eventBus,
  cloudAgentService
);

// Execute will automatically delegate to cloud if appropriate
const result = await executedProgramService.executeChannel(channelId);
```

### Manual Delegation Decisions

You can manually check if a task should be delegated:

```typescript
// Check if parsing should be delegated
const decision = cloudAgentService.shouldDelegateParsing(program);
if (decision.shouldDelegate) {
  console.log(`Delegating: ${decision.reason}`);
  console.log(`Estimated time: ${decision.estimatedCloudTime}ms (cloud) vs ${decision.estimatedLocalTime}ms (local)`);
}

// Check if execution should be delegated
const execDecision = cloudAgentService.shouldDelegateExecution(programs);
```

### Getting Statistics

Monitor delegation performance:

```typescript
const stats = cloudAgentService.getStats();
console.log(`Total tasks: ${stats.totalTasks}`);
console.log(`Cloud tasks: ${stats.cloudTasks}`);
console.log(`Local tasks: ${stats.localTasks}`);
console.log(`Delegation rate: ${(stats.delegationRate * 100).toFixed(1)}%`);
console.log(`Failed delegations: ${stats.failedDelegations}`);
```

### Runtime Configuration

Update configuration at runtime:

```typescript
// Enable/disable cloud delegation
cloudAgentService.setEnabled(false);

// Update specific thresholds
cloudAgentService.updateConfig({
  thresholds: {
    programSizeBytes: 50000,
    lineCount: 1000,
  },
});

// Check availability
const isAvailable = await cloudAgentService.isAvailable();
```

## Complexity Scoring

The complexity score (0-100) is calculated based on:

- **Program Size** (up to 20 points): Larger programs get higher scores
- **Line Count** (up to 20 points): More lines increase complexity
- **Complex G-codes** (up to 20 points): G2/G3/G4 codes add complexity
- **Tool Changes** (up to 15 points): T-codes for tool changes
- **Synchronization Codes** (up to 15 points): M1xx/M2xx codes for multi-channel sync
- **Subprogram Calls** (up to 10 points): M98 calls for macros/subprograms

Programs with scores above the threshold (default 70) are candidates for cloud delegation.

## Service Registration

The service is automatically registered in `main.ts`:

```typescript
registry.register(
  SERVICE_TOKENS.CloudAgentService,
  () => {
    const backendGateway = registry.get<BackendGateway>(SERVICE_TOKENS.BackendGateway);
    const eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);
    return new CloudAgentService(backendGateway, eventBus, {
      enabled: true,
      autoDelegate: true,
    });
  },
  {
    singleton: true,
    dependencies: [SERVICE_TOKENS.BackendGateway, SERVICE_TOKENS.EventBus],
  }
);
```

## Events

The service emits events through the EventBus:

```typescript
// Task delegation event
{
  type: 'cloud:task-delegated',
  timestamp: number,
  payload: {
    taskType: 'parsing' | 'execution' | 'plotting',
    channelId?: ChannelId,
    decision?: DelegationDecision,
  }
}
```

## Future Enhancements

- Implementation of cloud endpoint integration
- Advanced optimization capabilities
- Simulation features
- Machine learning-based delegation decisions
- Adaptive threshold adjustment based on performance metrics

# NC-Edit7 Demo - 2 Channel Configuration

## What's Included

The demo launches with 2 active channels pre-loaded with NC code:

### Channel 1 (Left) - Mill Program
- Square pocket milling pattern
- G0/G1 rapid and feed moves
- Spindle control (M3/M5)
- Keywords panel shows: G0, G1, M3, M5, M30
- Tools panel: No tools (pure motion)

### Channel 2 (Right) - Arc Program
- Circular interpolation with G2
- Tool change with T1
- Keywords panel shows: G0, G1, G2, M3, M5, T1, M30
- Tools panel: T1 detected

### Three.js Plot (Right Side)
- 3D visualization with rotating camera
- Grid and axes for reference
- Ready to display toolpaths
- Each channel renders in different color

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│ NC-Edit7                              Machine: ISO_MILL     │
├─────────┬───────────────────────────────────────────────────┤
│CHANNELS │                                                   │
│[x] ch-1 │  ┌────────────────┬────────────────┬──────────┐  │
│[x] ch-2 │  │ KEYWORDS/TOOLS │   ACE EDITOR   │ THREE.JS │  │
│[ ] ch-3 │  │                │                │   PLOT   │  │
│         │  │ - G0, G1, M3   │  Program tab   │          │  │
│         │  │ - Tools: T1    │  [NC code]     │  [Grid]  │  │
│         │  │                │                │  [Axes]  │  │
│         │  └────────────────┴────────────────┴──────────┘  │
├─────────┴───────────────────────────────────────────────────┤
│ Ready                                                       │
└─────────────────────────────────────────────────────────────┘
```

## Features Demonstrated

1. **Multi-Channel Editing**: Two independent NC programs running side-by-side
2. **Real-Time Parsing**: Keywords and tools extracted as you type
3. **3D Visualization**: Three.js plot ready for toolpath rendering
4. **Interactive Navigation**: Click keywords/tools to jump to lines in editor
5. **Syntax Highlighting**: ACE editor with Monokai theme
6. **Variable Tracking**: Collapsible drawer (bottom) for registers 1-999
7. **Tab Switching**: Program/Executed views per channel
8. **Machine Selection**: Global machine selector (ISO_MILL)

## How to Use

1. **Edit Code**: Click in any editor and start typing NC commands
2. **Navigate**: Click on keywords/tools in left panel to jump to lines
3. **Toggle Channels**: Check/uncheck channels in left sidebar
4. **View Variables**: Click "Variables (0)" at bottom to expand register view
5. **Switch Views**: Click "Executed" tab to see server-processed results
6. **3D Plot**: Plot will show toolpaths when connected to backend

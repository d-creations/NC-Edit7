# Build Plan: Siemens 840D Mill Control Implementation

## Objective
Implement support for a Siemens Mill Machine with a Siemens 840D Channel in `ncplot7py`. The implementation should support the "ISO Milling" dialect as described in the provided manual (`PGM_0212_en_en-US (1).txt`) and provide a structure to support Siemens-native commands (`G290` mode).

## Architecture

### 1. New Machine Control Class
Create a new control class `StatefulSiemensMillControl` in `src/ncplot7py/infrastructure/machines/`.
This class will:
- Implement `BaseNCCanalInterface`.
- Initialize the execution chain specific to Siemens Milling.
- Manage the `CNCState` with defaults appropriate for milling (e.g., G17 plane, G94 feed).

### 2. New Handler Package
Create a new package `src/ncplot7py/domain/handlers/siemens_mill_cnc/` to house Siemens-specific handlers.

## Handlers to Implement

### A. Mode Switching (Critical)
- **Handler**: `SiemensModeHandler`
- **Function**: Handles `G290` (Siemens Mode) and `G291` (ISO Mode).
- **Logic**:
    - Sets a state flag (e.g., `state.extra['siemens_mode'] = True/False`).
    - Downstream handlers should check this flag to interpret codes correctly (e.g., G50 means Scaling in ISO, but might mean something else or be invalid in Siemens mode).

### B. Coordinate Systems
- **Handler**: `SiemensISOCoordinateHandler`
- **Codes**:
    - `G92`: Set Workpiece Coordinate System (replaces Fanuc G50).
    - `G53`: Machine Coordinate System.
    - `G54` - `G59`: Work Offset Selection.
    - `G50` / `G51`: Scaling (Optional, but distinct from Fanuc G50).
- **Difference from Fanuc**: Fanuc uses G50 for coordinate setting; Siemens ISO uses G92.

### C. Plane Selection
- **Handler**: `SiemensISOPlaneHandler` (or reuse `GCodeGroup16PlaneExecChainLink`)
- **Codes**: `G17` (XY), `G18` (XZ), `G19` (YZ).
- **Note**: Standard ISO behavior. Can likely reuse existing handler.

### D. Feed and Speed
- **Handler**: `SiemensISOFeedHandler`
- **Codes**:
    - `G94`: Feed per minute (Default for Mill).
    - `G95`: Feed per revolution.
- **Note**: Mill defaults to G94, whereas Lathe defaults to G95 (often).

### E. Tool Compensation (New)
- **Handler**: `SiemensISOToolLengthHandler`
- **Codes**:
    - `G43`: Tool Length Compensation + (Add).
    - `G44`: Tool Length Compensation - (Subtract).
    - `G49`: Tool Length Compensation Cancel.
- **Handler**: `SiemensISOCutterCompHandler`
- **Codes**:
    - `G40`: Cutter Radius Compensation Cancel.
    - `G41`: Cutter Radius Compensation Left.
    - `G42`: Cutter Radius Compensation Right.

### F. Polar Coordinates (New)
- **Handler**: `SiemensISOPolarHandler`
- **Codes**:
    - `G15`: Polar Coordinates Cancel.
    - `G16`: Polar Coordinates On.
    - `G12.1`: Polar Coordinate Interpolation Mode.
    - `G13.1`: Cancel Polar Coordinate Interpolation Mode.

### G. Units (New)
- **Handler**: `SiemensISOInchMetricHandler`
- **Codes**:
    - `G20`: Inch input.
    - `G21`: Metric input.

### H. Milling Cycles (New)
- **Handler**: `SiemensISOCyclesHandler`
- **Codes**:
    - `G81` - `G89`: Drilling, Boring, Tapping cycles.
    - `G73`: Deep hole drilling (chip break).
    - `G74`: Left-hand tapping.
    - `G76`: Fine boring.
    - `G80`: Cancel cycles.
- **Logic**: These cycles expand into multiple motions (rapid to clearance, feed to depth, retract).

### J. Misc (New)
- **Handler**: `SiemensISOMiscHandler`
- **Codes**:
    - `G04`: Dwell.
    - `G28`: Reference Point Return.

### K. Motion
- **Handler**: `MotionHandler` (Existing)
- **Codes**: `G00`, `G01`, `G02`, `G03`.
- **Note**: Existing handler is generic and supports X, Y, Z, I, J, K, R.

## Execution Chain Structure

The chain of responsibility for `StatefulSiemensMillControl` will be:

1.  **VariableHandler** (Existing): Macro variables.
2.  **ControlFlowHandler** (Existing): Loops, IF/GOTO.
3.  **SiemensModeHandler** (New): Detects G290/G291.
4.  **SiemensISOCyclesHandler** (New): Expands G8x cycles into motions.
5.  **SiemensISOFeedHandler** (New): Sets feed modes.
6.  **SiemensISOPlaneHandler** (Reuse/New): Sets G17/G18/G19.
7.  **SiemensISOPolarHandler** (New): Handles G15/G16.
8.  **SiemensISOToolLengthHandler** (New): Handles G43/G44/G49.
9.  **SiemensISOCutterCompHandler** (New): Handles G40/G41/G42.
10. **SiemensISOCoordinateHandler** (New): Handles G92, G54-G59.
11. **SiemensISOInchMetricHandler** (New): Handles G20/G21.
12. **SiemensISOMiscHandler** (New): Handles G04, G28.
13. **MotionHandler** (Existing): Executes moves.

## Summary of Work

1.  **Create Folder**: `src/ncplot7py/domain/handlers/siemens_mill_cnc/` (Done)
2.  **Create Handlers**:
    - `mode_handler.py` (G290/G291) (Done)
    - `coordinate_handler.py` (G92, G54-G59) (Done)
    - `feed_handler.py` (G94/G95) (Done)
    - `cycles_handler.py` (G81-G89) (Done - Placeholder)
    - `tool_length_handler.py` (G43/G44/G49) (Done)
    - `cutter_comp_handler.py` (G40/G41/G42) (Done - Placeholder)
    - `polar_handler.py` (G15/G16) (Done)
    - `unit_handler.py` (G20/G21) (Done)
    - `misc_handler.py` (G04, G28) (Done)
3.  **Create Control**: `src/ncplot7py/infrastructure/machines/stateful_siemens_mill_control.py` wiring the above handlers. (Done)
4.  **Testing**: Create a test script `scripts/run_siemens_example.py` and a test file `tests/integration/test_siemens_mill.py` with sample ISO Milling code. (Next Step)

## How to Execute Siemens NC Code

To execute Siemens NC code:
1.  Instantiate `StatefulSiemensMillControl`.
2.  Load the NC code (text file).
3.  Parse the code into `NCCommandNode` list (using existing parser).
4.  Call `control.run_nc_code_list(nodes)`.
5.  Retrieve tool path via `control.get_tool_path()`.

If the code contains `G290`, the `SiemensModeHandler` will switch the state. Future implementation can add a `SiemensNativeHandler` to the chain to handle non-ISO commands when `siemens_mode` is active.

## How to Execute Siemens NC Code

To execute Siemens NC code:
1.  Instantiate `StatefulSiemensMillControl`.
2.  Load the NC code (text file).
3.  Parse the code into `NCCommandNode` list (using existing parser).
4.  Call `control.run_nc_code_list(nodes)`.
5.  Retrieve tool path via `control.get_tool_path()`.

If the code contains `G290`, the `SiemensModeHandler` will switch the state. Future implementation can add a `SiemensNativeHandler` to the chain to handle non-ISO commands when `siemens_mode` is active.

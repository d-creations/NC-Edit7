# FOCAS 2 Integration Plan (Multi-Channel Program Transfer)

## 1. Objective
Integrate FANUC FOCAS 2 into NC-Edit7 using a Python backend via `ctypes` and a TypeScript/Electron frontend component. 
The system must safely upload and download NC programs, correctly handling multi-channel machines (PA = Main/Common, P1 = Path 1, P2 = Path 2).

## 2. Architecture Overview
- **Backend (Python)**: Uses `ctypes` to load `FWLIB64.DLL` / `FWLIB32.DLL`. Wraps functions securely to avoid memory crashes. Exposes FastAPI REST endpoints.
- **Frontend (TypeScript)**: Extends `MachineManager` to configure FOCAS IP/Port per machine. Adds a new `NCFocasTransfer` UI component to browse and transfer to/from specific channels.

## 3. Backend Implementation (FastAPI + ctypes)

### Required DLLs for `backend/focas_dlls/`
To enable 64-bit Ethernet FOCAS communication to modern Fanuc controls (like 30i/31i/0i-D/0i-F), copy the following files from your Fanuc CD into the `backend/focas_dlls/` folder:
- **`FWLIB64.DLL`**: The main FOCAS data window control library.
- **`FWLIBE64.DLL`**: The TCP/IP connectivity processing library (Required for Ethernet).
- **`FWLIB30i64.DLL`** (or `FWLIB0iD64.DLL`): The machine-specific function library (called dynamically by `FWLIB64.DLL`).

### Phase 1: Robust FOCAS Wrapper (`backend/focas_service.py`)
- **DLL Loading**: Dynamic loading of `FWLIB64.DLL`. No external pip packages needed.
- **Path Selection**: Use `cnc_setpath(handle, path_no)` to safely select Path 1 (P1) or Path 2 (P2) before any operation. 
- **Safe Download (`cnc_download3`)**:
    - Call `cnc_dwnstart3`.
    - Chunk the text data securely.
    - Check for `EW_BUFFER` and loop with short sleep to prevent overflow.
    - Ensure `cnc_dwnend3` is ALWAYS called via try/finally block so the CNC is never left in a blocked loading state.
- **Safe Upload (`cnc_upload3`)**:
    - Call `cnc_upstart3(handle, 0, prog_num, prog_num)`.
    - Read in 256/1024-byte chunks.
    - Terminate safely when `%` is detected.
    - Always invoke `cnc_upend3`.

### Phase 2: FastAPI Endpoints (`backend/main.py`)
- `/api/focas/connect` -> Returns true/false and max paths.
- `/api/focas/upload/{path_no}/{prog_num}` -> Pulls a program from the machine to the workspace.
- `/api/focas/download/{path_no}` -> Pushes a local program to the machine memory.

## 4. Frontend Implementation

### Phase 1: Machine Configuration Updates
- Update `MachineService` (`src/services/MachineService.ts`).
- Add fields for `focasIp`, `focasPort` (default 8193), and `focasEnabled`.

### Phase 2: FOCAS Transfer Component (`src/components/NCFocasTransfer.ts`)
- **Dual-Pane UI**:
    - Left side: Workspace files (from `VsCodeFileManagerService`).
    - Right side: CNC Memory (Requires `cnc_rdprogdir3` to list programs).
- **Multi-Channel & PA Program Display**:
    - Build a hierarchical view listing programs per channel (Path 1, Path 2, Path 3).
    - **PA file detection**: If Channel 1, 2, and 3 all contain a program with the exact same program number (e.g., `O1234`), intelligently group them and visually display them as a "PA" (Common/Merged) program. 
    - Dropdown or tabs to toggle between viewing "All Channels", "Path 1", "Path 2", or "Merged PA View".
- **Transfer Buttons**:
    - `>> Download to CNC >>`: Takes active editor text or selected file, formats it (`\nO1234\nG1...\n%`), and sends. For PA files, provides the ability to manually trigger the download to each specific channel individually (e.g., push specific parts of the PA file manually to Path 1 and Path 2).
    - `<< Upload from CNC <<`: Reads from CNC and opens in the editor's correct channel pane.

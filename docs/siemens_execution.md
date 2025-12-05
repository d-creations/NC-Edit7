# Siemens Mill Program Execution

I have created a script to run your Siemens NC program. The script is located at `ncplot7py/scripts/run_user_siemens_program.py`.

## Updates (Dec 5, 2025)

I have patched the core parser (`ncplot7py/src/ncplot7py/infrastructure/parsers/nc_command_parser.py`) to natively support Siemens syntax. This fixes the "Duplication of command" errors in the web app.

The parser now correctly handles:
*   **Siemens Cycles**: `CYCLE800(...)`, `POCKET4(...)`, etc. are treated as single commands and not split into characters.
*   **String Parameters**: `T="ToolName"` is correctly parsed.
*   **Keywords**: `MCALL`, `WORKPIECE`, `REPEAT`, `MSG`.

## Script Execution

The custom script `ncplot7py/scripts/run_user_siemens_program.py` still works and provides a simulation environment with mapped cycles (G81/G83).

## How to Run

Run the following command in the terminal:

```bash
python3 ncplot7py/scripts/run_user_siemens_program.py
```

## Output

The script will output:
*   The parsed commands.
*   Logs of executed Siemens cycles.
*   The generated toolpath segments (first 3 and last 3).

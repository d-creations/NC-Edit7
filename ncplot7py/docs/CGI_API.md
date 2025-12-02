# CGI API for `scripts/cgiserver.cgi`

This document describes the CGI interface implemented by `scripts/cgiserver.cgi`.

## Overview
- The CGI script accepts a JSON POST and returns a JSON response.
- The script logs the request into a MariaDB table (if DB credentials are configured).
- The core processing runs the project's NC execution engine and returns syncro plot data.

## Request payload shapes
Two accepted shapes:

1) Object with `machinedata` list:

{
  "machinedata": [
    { "program": "<nc-program>", "machineName": "<machine>", "canalNr": <number-or-string> },
    ...
  ]
}

2) Direct list of machine-data objects:

[
  { "program": "<nc-program>", "machineName": "<machine>", "canalNr": "<canal>" },
  ...
]

Each machine-data entry must include `program`, `machineName`, and `canalNr`.

## Allowed machine names
- SB12RG_F
- FANUC_T
- SR20JII_F
- SB12RG_B
- SR20JII_B
- ISO_MILL

## Validation rules
- Top-level must be an object containing `machinedata` or a list.
- Each entry must have `program`, `machineName`, and `canalNr`.
- `machineName` must be one of the allowed names above.
- `program` must NOT contain any of these characters: `(`, `)`, `{`, `}` — payloads containing them are rejected.

## Server-side preprocessing
- The script removes substrings matching `\(.*\)` from the program (comments in parentheses).
- Newlines are converted to semicolons: `\n` -> `;`.
- Spaces are removed from the program string.

## Side effects / logging
- The script attempts to insert a row into MariaDB `log.logNCR` with columns `IP` and `POST`.
- IP is taken from `REMOTE_ADDR` environment variable (trimmed to 19 characters) or "NAN" if missing.
- POST body is truncated when logged (approx 1000-1500 characters).
- MariaDB credentials must be provided in the running environment or script.

## Processing flow
- Builds initial `CNCState` instances per machine name.
- Sets X axis unit to `diameter` for lathe-style machines (SB12 and SR20, FANUC_T).
- Creates a `StatefulIsoTurnNCControl` with `count_of_canals`, `canal_names`, and initial `CNCState` list.
- Instantiates `NCExecutionEngine(control)` and calls `engine.get_Syncro_plot(programs, True)`.

## Response format
On success, a JSON object similar to:

{
  "canal": <engine_result>,
  "message": <message_stack>
}

- `canal` contains the syncro plot data returned by the execution engine.
- `message` is the project's message stack (diagnostics/info accumulated during processing).

On error, the script returns a JSON-like error message such as:

{"message_TEST": "<error>", "program": [ ... ]}

or

{"message_T": "<error>", "program": []}

(Exact shape may vary depending on where the exception was raised.)

## Example request (JSON body)

Single program (object with `machinedata`):

{
  "machinedata": [
    {
      "program": "N10 G00 X0 Y0\nN20 G01 X10 Y0",
      "machineName": "SB12RG_F",
      "canalNr": 1
    }
  ]
}

Equivalent as a plain list:

[
  {
    "program": "N10 G00 X0 Y0\nN20 G01 X10 Y0",
    "machineName": "SB12RG_F",
    "canalNr": "canal1"
  }
]

## Example PowerShell POST (replace URL)

```powershell
$json = @'
{
  "machinedata": [
    { "program": "N10 G00 X0 Y0\nN20 G01 X10 Y0", "machineName": "SB12RG_F", "canalNr": 1 }
  ]
}
'@

Invoke-RestMethod -Uri 'https://your-server/cgi-bin/cgiserver.cgi' -Method Post -Body $json -ContentType 'application/json'
```

## Example response (success)

```json
{
  "canal": [ /* engine-specific syncro plot structure */ ],
  "message": [ /* diagnostic messages */ ]
}
```

## Notes / caveats
- The script has two `request_precheck` blocks; the later one is authoritative for validation.
- Ensure MariaDB credentials and connectivity are configured in the environment where the CGI runs.
- Clients need not pre-normalize newlines or spaces; the server will remove spaces and convert newlines to semicolons, but clients must avoid forbidden characters.

## Listing available machines (new)

The CGI supports a lightweight request to retrieve the available machine names and a simple control type description.

Request JSON body:

{
  "action": "list_machines"
}

or

{
  "action": "get_machines"
}

Response JSON body:

{
  "machines": [
    { "machineName": "SB12RG_F", "controlType": "StatefulIsoTurnNCControl" },
    { "machineName": "SB12RG_B", "controlType": "StatefulIsoTurnNCControl" },
    ...
  ]
}

This is useful for clients to discover supported machine names before sending processing requests.

---

Generated from `scripts/cgiserver.cgi` in the repository. If you'd like, I can also add an automated test or a small example script under `scripts/` to POST a sample request and save the response.
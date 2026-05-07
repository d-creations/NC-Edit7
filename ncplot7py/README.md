# NC-Edit7 CGI Server

This directory contains the CGI server script for handling plot requests from the NC-Edit7 frontend.

## Overview

The `cgiserver.cgi` script is a Python CGI script that:
- Lists available CNC machines
- Processes NC programs and generates plot data
- Returns execution results including toolpath segments, variables, and timing

## API Endpoints

### List Machines

**Request:**
```json
{
  "action": "list_machines"
}
```

**Response:**
```json
{
  "machines": [
    {"machineName": "SIEMENS_840D", "controlType": "SIEMENS"},
    {"machineName": "FANUC_MILL", "controlType": "FANUC"},
    ...
  ],
  "success": true
}
```

### Execute Programs

**Request:**
```json
{
  "machinedata": [
    {
      "program": "G90 G54\nG0 X0 Y0 Z10\nG1 X50 Y0 F300\nM30",
      "machineName": "SIEMENS_840D",
      "canalNr": "channel-1",
      "customMachineConfig": {
        "control_type": "SIEMENS",
        "variable_prefix": "R"
      }
    }
  ]
}
```

*Note: `customMachineConfig` is optional (Bring Your Own Config - BYOC).*

**Response:**
```json
{
  "canal": {
    "channel-1": {
      "segments": [
        {
          "type": "RAPID",
          "lineNumber": 2,
          "toolNumber": 1,
          "points": [
            {"x": 0, "y": 0, "z": 0},
            {"x": 0, "y": 0, "z": 10}
          ]
        }
      ],
      "executedLines": [1, 2, 3, 4],
      "variables": {},
      "timing": [0.1, 0.1, 0.1, 0.1]
    }
  },
  "message": ["Successfully processed ISO_MILL canal channel-1"],
  "success": true
}
```

## Supported Machines

The default available machine configurations are defined in `ncplot7py/config/machines.json` and currently include:
- `SIEMENS_840D` - Siemens standard control
- `FANUC_MILL` - FANUC milling machine
- `FANUC_STAR` - FANUC basic lathe/Swiss
- `FANUC_STAR_SR20` - FANUC for Star SR20 series
- `FANUC_GENERIC` - Generic FANUC (default fallback)

## Deployment

### Apache Configuration

1. Enable CGI module:
   ```bash
   sudo a2enmod cgi
   ```

2. Configure virtual host:
   ```apache
   ScriptAlias /ncplot7py/scripts/ /var/www/NC-Edit7/ncplot7py/scripts/
   
   <Directory /var/www/NC-Edit7/ncplot7py/scripts>
       Options +ExecCGI
       AddHandler cgi-script .cgi
       Require all granted
   </Directory>
   ```

3. Make script executable:
   ```bash
   chmod +x cgiserver.cgi
   ```

### Testing

Test the CGI script directly:

```bash
# List machines
REQUEST_METHOD=POST CONTENT_LENGTH=30 python3 cgiserver.cgi <<EOF
{"action": "list_machines"}
EOF

# Execute program
cat > test.json <<'TESTEOF'
{"machinedata": [{"program": "G0 X0 Y0\nG1 X50 Y0", "machineName": "FANUC_GENERIC", "canalNr": "1"}]}
TESTEOF

REQUEST_METHOD=POST CONTENT_LENGTH=$(wc -c < test.json) python3 cgiserver.cgi < test.json
```

## Current Implementation

The current implementation is a **mock/demo version** that:
- Generates simple plot data from basic G-code parsing
- Provides placeholder execution results
- Does not require external dependencies

## Production Implementation

For production use, this script should be replaced with or extended to:
- Use the actual NC parser from the Python backend
- Integrate with the full CNC state machine
- Support advanced features like tool change detection, synchronization codes, etc.
- Connect to MariaDB for logging (see rebuild-plan.md for environment variables)

## Development

For local development with Vite dev server, the `dev-cgi-proxy.js` plugin handles CGI requests by spawning the Python script.

## Error Handling

The script returns error responses with `message_TEST` field:

```json
{
  "error": "Error description",
  "message_TEST": ["Detailed error message"]
}
```

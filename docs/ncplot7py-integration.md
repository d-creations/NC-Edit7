# Integrating `ncplot7py` Plot Calculations

`ncplot7py` ships a small CGI service (`scripts/cgiserver.cgi`) that exposes the legacy plot-calculation engine the main editor shell should call to keep NC toolpath plots synchronized with the parsed program.

## What the CGI expects

The endpoint only accepts POST requests with a JSON body. The payload must either be an object with a `machinedata` array or a direct array. Each item represents one channel and requires the keys:

- `program`: the NC code string (parentheses, braces, and brace-like characters are rejected).
- `machineName`: one of the supported machines (`SB12RG_F`, `SB12RG_B`, `SR20JII_F`, `SR20JII_B`, `FANUC_T`, `ISO_MILL`).
- `canalNr`: an identifier (string or number) for the channel being plotted.

### Pre-flight rules

1. The script preprocesses the program by removing inline parentheses comments (`\(.*\)`), replacing newlines with `;`, and stripping spaces before running the engine.
2. It logs the incoming payload (capped at 1500 characters) to a MariaDB table if credentials are available.
3. If any check (schema, invalid machine, illegal characters) fails, the CGI returns an error object with a `message_TEST` or `message_T` string for diagnostics.

## Expected response format

Successful responses mirror the legacy API:

```json
{
  "canal": [ /* array of per-channel sync/plot data */ ],
  "message": [ /* localized log entries from `get_message_stack()` */ ]
}
```

When the client is just discovering machines, send `{ "action": "list_machines" }` or `{ "action": "get_machines" }` and the CGI responds with:

```json
{
  "machines": [
    { "machineName": "SB12RG_F", "controlType": "StatefulIsoTurnNCControl" },
    ...
  ]
}
```

## How to call it from the editor

1. **Build the request payload** from the `ChannelState` you already maintain in `StateService`. Each channel’s latest `parseResult` can be joined back into a single string (keep `\n` or rehydrate semicolons; the service will clean it again).
2. **POST to `/ncplot7py/scripts/cgiserver.cgi`** (adjust path if the service is hosted elsewhere). Include `Content-Type: application/json` and the JSON payload.
3. **Handle errors** by checking for `message_TEST`/`message_T` in the response—log them to DiagnosticsService or show them in the UI.
4. On success, pass the returned `canal` array to whatever plotting service (three.js or mock) you’re using; it already contains the synchronized toolpath data.

### Example fetch call (browser)

```ts
const payload = {
  machinedata: state.channels.map((channel) => ({
    canalNr: channel.channelId,
    machineName: channel.machineName ?? "ISO_MILL",
    program: channel.program,
  })),
};

const response = await fetch("/ncplot7py/scripts/cgiserver.cgi", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const body = await response.json();
if (body.message_TEST || body.message_T) {
  throw new Error(body.message_TEST ?? body.message_T);
}

const plotData = body.canal;
```

## Where to place the logic

- Keep the CGI URL in a configuration file so the path is adjustable per deployment.
- Wrap the HTTP call in a `PlotService` that converts `parseResult` into the payload above and caches the most recent plot result per channel.
- Re-run the request each time `channelUpdated` emits a fresh `ChannelState` (or throttle if the UI edits rapidly).

## Logging and diagnostics

If you integrate this backend, `cgiserver.cgi` already logs each request to MariaDB (when credentials are present) and returns a localized `message` stack. Use those messages to populate `DiagnosticsService` so users can see why a plot might be stale or invalid.

## Next steps

- Mirror the CGI’s allowed machine list with your UI dropdown (`machines` endpoint is useful during bootstrap).
- Feed the returned plot payload into your three.js renderer or mock backend to visually align each channel’s timeline with the parsed code.
- Consider running a local copy of the CGI during development so you can test `plotRequest` networking without deploying the whole stack.

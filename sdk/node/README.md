# @opspilot/node

Small Node.js SDK for consuming published OpsPilot runtime configuration.

## Example

```js
const { OpsPilotClient } = require("@opspilot/node");

const opspilot = new OpsPilotClient({
  baseUrl: process.env.OPSPILOT_URL,
  apiKey: process.env.OPSPILOT_API_KEY,
  refreshIntervalMs: 60_000,

  // Optional resilience layer. The latest successful snapshot is written
  // atomically and can be loaded again after the customer process restarts.
  snapshotFile: "./var/opspilot-runtime.json",
  maxStaleMs: 24 * 60 * 60 * 1000,
});

await opspilot.refresh();

const maxRetries = opspilot.get("payment.maxRetries", 3);
const maintenance = opspilot.get("checkout.maintenanceMode", false);

opspilot.startPolling({
  onUpdate(snapshot) {
    console.log("Runtime config refreshed", snapshot.sdk.source);
  },
  onError(error) {
    console.error("Refresh failed", error);
  },
});
```

The key is sent as `Authorization: Bearer <service-key>`. The backend binds
that key to one project and one environment, so the consumer does not choose
its own project/environment in the request.

## Snapshot sources

- `network` — the configuration was fetched from OpsPilot.
- `memory` — a recent in-memory snapshot was reused.
- `disk` — a persisted snapshot was restored after process startup.
- `stale` — a refresh failed, but the latest snapshot is still inside
  `maxStaleMs`.

The optional `snapshotFile` protects the consumer from the combined case where
OpsPilot is temporarily unavailable **and** the customer process has restarted.
If the snapshot is older than `maxStaleMs`, the SDK stops trusting it and
surfaces the refresh error instead of serving configuration forever.

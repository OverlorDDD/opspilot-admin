# @opspilot/node

Small Node.js SDK for consuming published OpsPilot runtime configuration.

## Example

```js
const { OpsPilotClient } = require("@opspilot/node");

const opspilot = new OpsPilotClient({
  baseUrl: process.env.OPSPILOT_URL,
  apiKey: process.env.OPSPILOT_API_KEY,
  refreshIntervalMs: 60_000,
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

The client keeps the last successful snapshot in memory and can return it as
`source: "stale"` if OpsPilot is temporarily unavailable.

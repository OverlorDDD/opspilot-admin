const { OpsPilotClient } = require("../dist/index.js");

async function main() {
  const baseUrl = process.env.OPSPILOT_URL ?? "http://localhost:3000";
  const apiKey = process.env.OPSPILOT_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Set OPSPILOT_API_KEY to a service key created in OpsPilot Integrations.",
    );
  }

  const client = new OpsPilotClient({
    baseUrl,
    apiKey,
    refreshIntervalMs: 60_000,
    timeoutMs: 5_000,
  });

  const first = await client.refresh();
  const second = await client.getConfig();

  console.log("Connected to:", first.project.name);
  console.log("Environment:", first.environment);
  console.log("First read source:", first.sdk.source);
  console.log("Second read source:", second.sdk.source);
  console.log("Values:");
  console.log(JSON.stringify(second.values, null, 2));
}

main().catch((error) => {
  console.error("Consumer failed:", error.message);
  process.exitCode = 1;
});

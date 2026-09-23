import { performance } from "node:perf_hooks";

const baseUrl = process.env.OPSPILOT_URL ?? "http://localhost:3000";
const apiKey = process.env.OPSPILOT_API_KEY;
const totalRequests = positiveInteger(process.env.LOAD_TOTAL_REQUESTS, 500);
const concurrency = positiveInteger(process.env.LOAD_CONCURRENCY, 20);
const endpoint = `${baseUrl.replace(/\/$/, "")}/api/runtime/v1/config`;

if (!apiKey) {
  console.error("Set OPSPILOT_API_KEY before running the load test.");
  process.exit(1);
}

const latencies = [];
const statuses = new Map();
let nextIndex = 0;
let transportErrors = 0;

const startedAt = performance.now();

await Promise.all(
  Array.from({ length: Math.min(concurrency, totalRequests) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= totalRequests) return;

      const requestStartedAt = performance.now();

      try {
        const response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        });

        const elapsed = performance.now() - requestStartedAt;
        statuses.set(
          response.status,
          (statuses.get(response.status) ?? 0) + 1,
        );

        if (response.ok) {
          latencies.push(elapsed);
        }

        await response.arrayBuffer();
      } catch {
        transportErrors += 1;
      }
    }
  }),
);

const totalMs = performance.now() - startedAt;
latencies.sort((a, b) => a - b);

console.log("");
console.log("OpsPilot runtime API load test");
console.log("--------------------------------");
console.log(`Endpoint:       ${endpoint}`);
console.log(`Requests:       ${totalRequests}`);
console.log(`Concurrency:    ${concurrency}`);
console.log(`Duration:       ${(totalMs / 1_000).toFixed(2)}s`);
console.log(
  `Throughput:     ${((totalRequests - transportErrors) / (totalMs / 1_000)).toFixed(1)} req/s`,
);
console.log(
  `HTTP statuses:  ${[...statuses.entries()]
    .sort(([a], [b]) => a - b)
    .map(([status, count]) => `${status}=${count}`)
    .join(", ") || "none"}`,
);
console.log(`Transport errs: ${transportErrors}`);

if (latencies.length) {
  console.log(`Latency p50:    ${percentile(latencies, 0.5).toFixed(1)} ms`);
  console.log(`Latency p95:    ${percentile(latencies, 0.95).toFixed(1)} ms`);
  console.log(`Latency p99:    ${percentile(latencies, 0.99).toFixed(1)} ms`);
}

console.log("");
console.log(
  "Note: the runtime endpoint has a per-service-key rate limit. " +
    "For a dedicated local performance experiment, raise " +
    "RUNTIME_RATE_LIMIT_PER_MINUTE deliberately and restart the API.",
);

function percentile(values, fraction) {
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil(values.length * fraction) - 1),
  );
  return values[index];
}

function positiveInteger(raw, fallback) {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

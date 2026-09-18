import assert from "node:assert/strict";
import test from "node:test";
import { OpsPilotClient } from "./index";

const runtime = {
  project: { id: "acme-store", name: "Acme Store" },
  environment: "production" as const,
  values: {
    "checkout.maintenanceMode": false,
    "payment.maxRetries": 3,
  },
  generatedAt: "2026-09-18T00:00:00.000Z",
};

test("fetches once and serves the next read from memory", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async (_input, init) => {
    calls += 1;
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer opk_test_secret",
    );
    return new Response(JSON.stringify(runtime), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const client = new OpsPilotClient({
      baseUrl: "https://opspilot.example",
      apiKey: "opk_test_secret",
      refreshIntervalMs: 60_000,
    });

    const first = await client.getConfig();
    const second = await client.getConfig();

    assert.equal(first.sdk.source, "network");
    assert.equal(second.sdk.source, "memory");
    assert.equal(calls, 1);
    assert.equal(client.get("payment.maxRetries", 1), 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("returns the last snapshot as stale when refresh fails", async () => {
  const originalFetch = globalThis.fetch;
  let fail = false;

  globalThis.fetch = async () => {
    if (fail) throw new Error("network down");
    return new Response(JSON.stringify(runtime), { status: 200 });
  };

  try {
    const client = new OpsPilotClient({
      baseUrl: "https://opspilot.example",
      apiKey: "opk_test_secret",
      refreshIntervalMs: 1_000,
    });

    await client.refresh();
    fail = true;

    const fallback = await client.refresh();
    assert.equal(fallback.sdk.source, "stale");
    assert.equal(fallback.values["payment.maxRetries"], 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

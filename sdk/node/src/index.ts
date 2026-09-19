export type ConfigValue =
  | number
  | boolean
  | string
  | Record<string, unknown>;

export type EnvironmentName = "development" | "staging" | "production";

export interface RuntimeConfig {
  project: {
    id: string;
    name: string;
  };
  environment: EnvironmentName;
  values: Record<string, ConfigValue>;
  generatedAt: string;
  cache?: {
    status: "HIT" | "MISS" | "BYPASS";
    ttlSeconds: number;
  };
}

export type SnapshotSource = "network" | "memory" | "stale";

export interface OpsPilotSnapshot extends RuntimeConfig {
  sdk: {
    source: SnapshotSource;
    fetchedAt: string;
  };
}

export interface OpsPilotClientOptions {
  baseUrl: string;
  apiKey: string;
  refreshIntervalMs?: number;
  timeoutMs?: number;
}

export interface PollingOptions {
  onUpdate?: (snapshot: OpsPilotSnapshot) => void;
  onError?: (error: Error) => void;
}

export class OpsPilotClient {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly refreshIntervalMs: number;
  private readonly timeoutMs: number;
  private snapshot: OpsPilotSnapshot | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: OpsPilotClientOptions) {
    if (!options.apiKey.startsWith("opk_")) {
      throw new Error("OpsPilot apiKey must start with 'opk_'");
    }

    this.endpoint =
      options.baseUrl.replace(/\/$/, "") + "/api/runtime/v1/config";
    this.apiKey = options.apiKey;
    this.refreshIntervalMs = Math.max(
      1_000,
      options.refreshIntervalMs ?? 60_000,
    );
    this.timeoutMs = Math.max(500, options.timeoutMs ?? 5_000);
  }

  async getConfig(options: { force?: boolean } = {}): Promise<OpsPilotSnapshot> {
    if (!options.force && this.isFresh()) {
      return this.withSource(this.snapshot!, "memory");
    }

    try {
      const runtime = await this.fetchRuntime();
      const snapshot: OpsPilotSnapshot = {
        ...runtime,
        sdk: {
          source: "network",
          fetchedAt: new Date().toISOString(),
        },
      };
      this.snapshot = snapshot;
      return snapshot;
    } catch (error) {
      if (this.snapshot) {
        return this.withSource(this.snapshot, "stale");
      }

      throw this.normalizeError(error);
    }
  }

  async refresh(): Promise<OpsPilotSnapshot> {
    return this.getConfig({ force: true });
  }

  get<T extends ConfigValue>(key: string, fallback: T): T {
    const value = this.snapshot?.values[key];
    return (value === undefined ? fallback : value) as T;
  }

  startPolling(options: PollingOptions = {}): () => void {
    if (this.timer) {
      return () => this.stopPolling();
    }

    const poll = async () => {
      try {
        const snapshot = await this.refresh();
        options.onUpdate?.(snapshot);
      } catch (error) {
        options.onError?.(this.normalizeError(error));
      }
    };

    void poll();
    this.timer = setInterval(() => void poll(), this.refreshIntervalMs);
    this.timer.unref?.();

    return () => this.stopPolling();
  }

  stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private isFresh(): boolean {
    if (!this.snapshot) return false;
    const age =
      Date.now() - new Date(this.snapshot.sdk.fetchedAt).getTime();
    return age < this.refreshIntervalMs;
  }

  private async fetchRuntime(): Promise<RuntimeConfig> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      const body = (await response.json().catch(() => ({}))) as
        | RuntimeConfig
        | { message?: string | string[] };

      if (!response.ok) {
        const rawMessage = "message" in body ? body.message : undefined;
        const message = Array.isArray(rawMessage)
          ? rawMessage.join(", ")
          : rawMessage;
        throw new Error(
          message || `OpsPilot runtime request failed with ${response.status}`,
        );
      }

      return body as RuntimeConfig;
    } finally {
      clearTimeout(timeout);
    }
  }

  private withSource(
    snapshot: OpsPilotSnapshot,
    source: SnapshotSource,
  ): OpsPilotSnapshot {
    return {
      ...snapshot,
      sdk: {
        ...snapshot.sdk,
        source,
      },
    };
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return new Error(
          `OpsPilot runtime request timed out after ${this.timeoutMs}ms`,
        );
      }
      return error;
    }
    return new Error("Unknown OpsPilot client error");
  }
}

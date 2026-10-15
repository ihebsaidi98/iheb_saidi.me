/**
 * src/lib/ai-service-client.ts
 *
 * Server-side client for communicating with the internal Python AI Service.
 *
 * SECURITY:
 *   - Runs exclusively in Node.js runtime (server-side).
 *   - AI_SERVICE_TOKEN and AI_SERVICE_URL are never exposed to client bundles.
 *   - Injects correlation X-Request-ID and enforces bounded timeouts.
 */

export type AIServiceHealth = {
  status: string;
  service: string;
  version: string;
  environment: string;
  gemini_configured: boolean;
};

export type AIServiceInfo = {
  service: string;
  version: string;
  phase: number;
  environment: string;
  active_chat_model: string;
  active_embedding_model: string;
  capabilities: string[];
};

export type AIServiceError = {
  error: {
    code: string;
    message: string;
    request_id?: string;
  };
};

export class AIServiceClient {
  private readonly baseUrl: string;
  private readonly internalToken: string;

  constructor(options: { baseUrl?: string; token?: string } = {}) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.AI_SERVICE_URL ??
      "http://127.0.0.1:8001"
    ).replace(/\/+$/, "");
    this.internalToken =
      options.token ?? process.env.AI_SERVICE_TOKEN ?? "dev-internal-token-change-in-production";
  }

  /**
   * Check unauthenticated readiness probe of the Python AI service.
   */
  async checkHealth(timeoutMs = 5000): Promise<AIServiceHealth> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/health/ready`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(
          `AI Service health check failed with status ${res.status}: ${res.statusText}`,
        );
      }

      return (await res.json()) as AIServiceHealth;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Fetch authenticated internal service info (/v1/info).
   */
  async getServiceInfo(
    options: { requestId?: string; timeoutMs?: number } = {},
  ): Promise<AIServiceInfo> {
    const timeoutMs = options.timeoutMs ?? 10_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Internal-Token": this.internalToken,
    };

    if (options.requestId) {
      headers["X-Request-ID"] = options.requestId;
    }

    try {
      const res = await fetch(`${this.baseUrl}/v1/info`, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      if (!res.ok) {
        let errData: AIServiceError | null = null;
        try {
          errData = (await res.json()) as AIServiceError;
        } catch {
          // Non-JSON error payload
        }
        const errorMsg =
          errData?.error?.message ?? `AI Service request failed with HTTP ${res.status}`;
        throw new Error(`[AIServiceClient] ${errorMsg}`);
      }

      return (await res.json()) as AIServiceInfo;
    } finally {
      clearTimeout(timer);
    }
  }
}

// Module-level singleton instance for server-side usage
export const aiServiceClient = new AIServiceClient();

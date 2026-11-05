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

type AIServiceInfo = {
  service: string;
  version: string;
  phase: number;
  environment: string;
  active_chat_model: string;
  active_embedding_model: string;
  capabilities: string[];
};

type AIServiceError = {
  error: {
    code: string;
    message: string;
    request_id?: string;
  };
};

type AIServiceChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AskRagOptions = {
  limit?: number;
  threshold?: number;
  history?: AIServiceChatMessage[];
  requestId?: string;
  timeoutMs?: number;
};

export type AIServiceChatSource = {
  id: string;
  title: string;
  type: string;
};

export type AIServiceChatResponse = {
  reply: string;
  sources: AIServiceChatSource[];
};

export type InterviewTrack = "full_stack" | "backend" | "frontend" | "ai_ml";
export type InterviewDifficulty = "standard" | "senior" | "lead";

export type InterviewQuestionContextSource = {
  id: string;
  title: string;
  type: string;
};

export type InterviewQuestion = {
  question_id: string;
  question_number: number;
  total_questions: number;
  question_text: string;
  question_type: "mcq" | "open_ended";
  track: InterviewTrack;
  topic: string;
  options?: string[] | null;
  expected_talking_points?: string[];
  context_source?: InterviewQuestionContextSource | null;
  difficulty?: InterviewDifficulty;
};

export type StartInterviewOptions = {
  track?: InterviewTrack;
  difficulty?: InterviewDifficulty;
  focus_areas?: string[];
  clientIpKey?: string;
  requestId?: string;
  timeoutMs?: number;
};

export type StartInterviewResponse = {
  session_id: string;
  session_token: string;
  track: InterviewTrack;
  total_questions: number;
  initial_question: InterviewQuestion;
};

export type SubmitAnswerOptions = {
  session_id: string;
  session_token: string;
  question_id: string;
  answer: string;
  requestId?: string;
  timeoutMs?: number;
};

export type SubmitAnswerAck = {
  session_id: string;
  question_id: string;
  question_number: number;
  answered_count: number;
  total_questions: number;
  is_complete: boolean;
  next_question?: InterviewQuestion | null;
};

export type SubmitAnswerResponse = SubmitAnswerAck;

export type CompleteInterviewOptions = {
  session_id: string;
  session_token: string;
  requestId?: string;
  timeoutMs?: number;
};

export type MCQResult = {
  question_id: string;
  question_number: number;
  topic: string;
  question_text: string;
  options: string[];
  submitted_answer: string;
  correct_answer: string;
  correct_answer_index: number;
  is_correct: boolean;
  source_url: string;
  source_title: string;
  explanation: string;
};

export type WrittenRubricScore = {
  accuracy: number;
  depth: number;
  clarity: number;
  problem_solving: number;
  overall_score: number;
};

export type RubricScore = WrittenRubricScore;

export type WrittenResult = {
  question_id: string;
  question_number: number;
  topic: string;
  question_text: string;
  submitted_answer: string;
  rubric: WrittenRubricScore;
  strengths: string[];
  areas_for_improvement: string[];
  ideal_answer: string;
  source_url: string;
  source_title: string;
};

export type TopicScore = {
  topic: string;
  score: number;
  max_score: number;
};

export type SessionCompletionReport = {
  session_id: string;
  track: InterviewTrack;
  score_out_of_100: number;
  mcq_score: number;
  written_score: number;
  mcq_results: MCQResult[];
  written_results: WrittenResult[];
  topic_breakdown: TopicScore[];
  overall_strengths: string[];
  overall_improvements: string[];
  total_questions: number;
};

export class AIServiceClientError extends Error {
  readonly status?: number;
  readonly code: string;
  readonly isUnavailable: boolean;
  readonly requestId?: string;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      isUnavailable?: boolean;
      requestId?: string;
      cause?: unknown;
    } = {},
  ) {
    super(`[AIServiceClient] ${message}`);
    this.name = "AIServiceClientError";
    this.status = options.status;
    this.code = options.code ?? "AI_SERVICE_ERROR";
    this.isUnavailable = options.isUnavailable ?? false;
    this.requestId = options.requestId;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export class AIServiceClient {
  private readonly baseUrl: string;
  private readonly internalToken: string;
  private readonly explicitlyConfigured: boolean;

  constructor(options: { baseUrl?: string; token?: string } = {}) {
    const envUrl = process.env.AI_SERVICE_URL;
    this.explicitlyConfigured = Boolean(
      options.baseUrl || (envUrl && envUrl.trim().length > 0),
    );
    this.baseUrl = (
      options.baseUrl ??
      envUrl ??
      "http://127.0.0.1:8001"
    ).replace(/\/+$/, "");
    // H2: no built-in fallback credential.  A client without an explicit token
    // sends no authentication header at all instead of presenting a secret that
    // is public in the repository.
    this.internalToken = (
      options.token ??
      process.env.AI_SERVICE_TOKEN ??
      ""
    ).trim();
  }

  /**
   * Build the internal authentication header, or nothing when no token is set.
   * Omitting the header keeps the AI service's 401 path authoritative.
   */
  private authHeaders(): Record<string, string> {
    return this.internalToken
      ? { "X-Internal-Token": this.internalToken }
      : {};
  }

  /**
   * Returns true only when a base URL AND an internal token are available
   * (via options or env) and delegation is not explicitly disabled.
   *
   * H2: a URL alone is not a valid configuration — delegating without a
   * credential would just produce 401s, so callers treat this as unavailable.
   */
  isConfigured(): boolean {
    if (process.env.AI_SERVICE_ENABLED === "false") {
      return false;
    }
    return this.explicitlyConfigured && this.internalToken.length > 0;
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
        throw new AIServiceClientError(
          `AI Service health check failed with status ${res.status}: ${res.statusText}`,
          { status: res.status, isUnavailable: true },
        );
      }

      return (await res.json()) as AIServiceHealth;
    } catch (err) {
      if (err instanceof AIServiceClientError) {
        throw err;
      }
      const isTimeout =
        err instanceof Error &&
        (err.name === "AbortError" || controller.signal.aborted);
      throw new AIServiceClientError(
        isTimeout ? "Health check timed out" : "AI service health check failed",
        {
          isUnavailable: true,
          code: isTimeout ? "TIMEOUT" : "UNAVAILABLE",
          cause: err,
        },
      );
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
      ...this.authHeaders(),
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
          errData?.error?.message ??
          `AI Service request failed with HTTP ${res.status}`;
        const isUnavailable = res.status === 503 || res.status === 504;
        throw new AIServiceClientError(errorMsg, {
          status: res.status,
          code:
            errData?.error?.code ??
            (res.status === 401 ? "UNAUTHORIZED" : "HTTP_ERROR"),
          isUnavailable,
          requestId: errData?.error?.request_id ?? options.requestId,
        });
      }

      return (await res.json()) as AIServiceInfo;
    } catch (err) {
      if (err instanceof AIServiceClientError) {
        throw err;
      }
      const isTimeout =
        err instanceof Error &&
        (err.name === "AbortError" || controller.signal.aborted);
      throw new AIServiceClientError(
        isTimeout ? "Service info request timed out" : "AI service unreachable",
        {
          isUnavailable: true,
          code: isTimeout ? "TIMEOUT" : "UNAVAILABLE",
          cause: err,
        },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Request grounded portfolio chat answer from FastAPI AI Service (POST /v1/rag/chat).
   */
  async askRag(
    message: string,
    options: AskRagOptions = {},
  ): Promise<AIServiceChatResponse> {
    const timeoutMs = options.timeoutMs ?? 15_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...this.authHeaders(),
    };

    if (options.requestId) {
      headers["X-Request-ID"] = options.requestId;
    }

    const payload: {
      message: string;
      limit?: number;
      threshold?: number;
      history?: AIServiceChatMessage[];
    } = {
      message,
    };

    if (typeof options.limit === "number") {
      payload.limit = options.limit;
    }
    if (typeof options.threshold === "number") {
      payload.threshold = options.threshold;
    }
    if (Array.isArray(options.history) && options.history.length > 0) {
      payload.history = options.history;
    }

    try {
      const res = await fetch(`${this.baseUrl}/v1/rag/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
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
          errData?.error?.message ??
          `AI Service RAG request failed with HTTP ${res.status}`;
        const errorCode =
          errData?.error?.code ??
          (res.status === 401
            ? "UNAUTHORIZED"
            : res.status === 403
              ? "FORBIDDEN"
              : res.status === 503
                ? "SERVICE_UNAVAILABLE"
                : "HTTP_ERROR");

        const isUnavailable = res.status === 503 || res.status === 504;

        throw new AIServiceClientError(errorMsg, {
          status: res.status,
          code: errorCode,
          isUnavailable,
          requestId: errData?.error?.request_id ?? options.requestId,
        });
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new AIServiceClientError(
          "Failed to parse JSON response from AI service",
          {
            status: 200,
            code: "INVALID_RESPONSE",
            isUnavailable: false,
            requestId: options.requestId,
            cause: parseErr,
          },
        );
      }

      if (
        !data ||
        typeof data !== "object" ||
        typeof (data as Record<string, unknown>).reply !== "string" ||
        !Array.isArray((data as Record<string, unknown>).sources)
      ) {
        throw new AIServiceClientError(
          "Invalid response schema from AI service",
          {
            status: 200,
            code: "INVALID_RESPONSE",
            isUnavailable: false,
            requestId: options.requestId,
          },
        );
      }

      const sources = (data as { sources: unknown[] }).sources;
      const isValidSources = sources.every(
        (s) =>
          s &&
          typeof s === "object" &&
          typeof (s as Record<string, unknown>).id === "string" &&
          typeof (s as Record<string, unknown>).title === "string" &&
          typeof (s as Record<string, unknown>).type === "string",
      );

      if (!isValidSources) {
        throw new AIServiceClientError(
          "Invalid sources array schema from AI service",
          {
            status: 200,
            code: "INVALID_RESPONSE",
            isUnavailable: false,
            requestId: options.requestId,
          },
        );
      }

      return data as AIServiceChatResponse;
    } catch (err) {
      if (err instanceof AIServiceClientError) {
        throw err;
      }

      const isTimeout =
        err instanceof Error &&
        (err.name === "AbortError" || controller.signal.aborted);

      throw new AIServiceClientError(
        isTimeout ? "RAG request timed out" : "AI service unreachable",
        {
          isUnavailable: true,
          code: isTimeout ? "TIMEOUT" : "UNAVAILABLE",
          status: isTimeout ? 504 : 503,
          requestId: options.requestId,
          cause: err,
        },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Start an adaptive technical interview session (POST /v1/interview/start).
   */
  async startInterview(
    options: StartInterviewOptions = {},
  ): Promise<StartInterviewResponse> {
    const timeoutMs = options.timeoutMs ?? 15_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...this.authHeaders(),
    };

    if (options.requestId) {
      headers["X-Request-ID"] = options.requestId;
    }

    if (options.clientIpKey) {
      headers["X-Client-IP-Key"] = options.clientIpKey;
    }

    const payload: {
      track?: string;
      difficulty?: string;
      focus_areas?: string[];
    } = {};

    if (options.track) {
      payload.track = options.track;
    }
    if (options.difficulty) {
      payload.difficulty = options.difficulty;
    }
    if (Array.isArray(options.focus_areas)) {
      payload.focus_areas = options.focus_areas;
    }

    try {
      const res = await fetch(`${this.baseUrl}/v1/interview/start`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
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
          errData?.error?.message ??
          `AI Service interview start failed with HTTP ${res.status}`;
        const errorCode =
          errData?.error?.code ??
          (res.status === 401
            ? "UNAUTHORIZED"
            : res.status === 403
              ? "FORBIDDEN"
              : res.status === 503
                ? "SERVICE_UNAVAILABLE"
                : "HTTP_ERROR");

        const isUnavailable = res.status === 503 || res.status === 504;

        throw new AIServiceClientError(errorMsg, {
          status: res.status,
          code: errorCode,
          isUnavailable,
          requestId: errData?.error?.request_id ?? options.requestId,
        });
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new AIServiceClientError(
          "Failed to parse JSON response from AI service",
          {
            status: 200,
            code: "INVALID_RESPONSE",
            isUnavailable: false,
            requestId: options.requestId,
            cause: parseErr,
          },
        );
      }

      const d = data as Record<string, unknown> | null;
      if (
        !d ||
        typeof d !== "object" ||
        typeof d.session_id !== "string" ||
        typeof d.session_token !== "string" ||
        typeof d.track !== "string" ||
        !d.initial_question ||
        typeof d.initial_question !== "object" ||
        typeof (d.initial_question as Record<string, unknown>).question_id !== "string" ||
        typeof (d.initial_question as Record<string, unknown>).question_text !== "string"
      ) {
        throw new AIServiceClientError(
          "Invalid start interview response schema from AI service",
          {
            status: 200,
            code: "INVALID_RESPONSE",
            isUnavailable: false,
            requestId: options.requestId,
          },
        );
      }

      return data as StartInterviewResponse;
    } catch (err) {
      if (err instanceof AIServiceClientError) {
        throw err;
      }

      const isTimeout =
        err instanceof Error &&
        (err.name === "AbortError" || controller.signal.aborted);

      throw new AIServiceClientError(
        isTimeout ? "Interview start request timed out" : "AI service unreachable",
        {
          isUnavailable: true,
          code: isTimeout ? "TIMEOUT" : "UNAVAILABLE",
          status: isTimeout ? 504 : 503,
          requestId: options.requestId,
          cause: err,
        },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Submit an answer blindly during the session (POST /v1/interview/submit-answer).
   */
  async submitInterviewAnswer(
    options: SubmitAnswerOptions,
  ): Promise<SubmitAnswerResponse> {
    const timeoutMs = options.timeoutMs ?? 15_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...this.authHeaders(),
    };

    if (options.requestId) {
      headers["X-Request-ID"] = options.requestId;
    }

    const payload = {
      session_id: options.session_id,
      session_token: options.session_token,
      question_id: options.question_id,
      answer: options.answer,
    };

    try {
      const res = await fetch(`${this.baseUrl}/v1/interview/submit-answer`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
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
          errData?.error?.message ??
          `AI Service interview submit failed with HTTP ${res.status}`;
        const errorCode =
          errData?.error?.code ??
          (res.status === 401
            ? "UNAUTHORIZED"
            : res.status === 403
              ? "FORBIDDEN"
              : res.status === 503
                ? "SERVICE_UNAVAILABLE"
                : "HTTP_ERROR");

        const isUnavailable = res.status === 503 || res.status === 504;

        throw new AIServiceClientError(errorMsg, {
          status: res.status,
          code: errorCode,
          isUnavailable,
          requestId: errData?.error?.request_id ?? options.requestId,
        });
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new AIServiceClientError(
          "Failed to parse JSON response from AI service",
          {
            status: 200,
            code: "INVALID_RESPONSE",
            isUnavailable: false,
            requestId: options.requestId,
            cause: parseErr,
          },
        );
      }

      const d = data as Record<string, unknown> | null;
      if (
        !d ||
        typeof d !== "object" ||
        typeof d.session_id !== "string" ||
        typeof d.question_id !== "string" ||
        typeof d.question_number !== "number" ||
        typeof d.answered_count !== "number" ||
        typeof d.total_questions !== "number" ||
        typeof d.is_complete !== "boolean"
      ) {
        throw new AIServiceClientError(
          "Invalid submit interview response schema from AI service",
          {
            status: 200,
            code: "INVALID_RESPONSE",
            isUnavailable: false,
            requestId: options.requestId,
          },
        );
      }

      return data as SubmitAnswerResponse;
    } catch (err) {
      if (err instanceof AIServiceClientError) {
        throw err;
      }

      const isTimeout =
        err instanceof Error &&
        (err.name === "AbortError" || controller.signal.aborted);

      throw new AIServiceClientError(
        isTimeout ? "Interview submit request timed out" : "AI service unreachable",
        {
          isUnavailable: true,
          code: isTimeout ? "TIMEOUT" : "UNAVAILABLE",
          status: isTimeout ? 504 : 503,
          requestId: options.requestId,
          cause: err,
        },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Complete interview session and retrieve score out of 100 and comprehensive report (POST /v1/interview/complete).
   */
  async completeInterviewSession(
    options: CompleteInterviewOptions,
  ): Promise<SessionCompletionReport> {
    // 40s: above the AI service's 20s completion-wide LLM budget, below the
    // reverse proxy's 60s `proxy_read_timeout`. Scoring five written answers
    // used to outlast the old 30s value and report a timeout for work that
    // would have completed.
    const timeoutMs = options.timeoutMs ?? 40_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...this.authHeaders(),
    };

    if (options.requestId) {
      headers["X-Request-ID"] = options.requestId;
    }

    const payload = {
      session_id: options.session_id,
      session_token: options.session_token,
    };

    try {
      const res = await fetch(`${this.baseUrl}/v1/interview/complete`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
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
          errData?.error?.message ??
          `AI Service interview complete failed with HTTP ${res.status}`;
        const errorCode =
          errData?.error?.code ??
          (res.status === 401
            ? "UNAUTHORIZED"
            : res.status === 403
              ? "FORBIDDEN"
              : res.status === 503
                ? "SERVICE_UNAVAILABLE"
                : "HTTP_ERROR");

        const isUnavailable = res.status === 503 || res.status === 504;

        throw new AIServiceClientError(errorMsg, {
          status: res.status,
          code: errorCode,
          isUnavailable,
          requestId: errData?.error?.request_id ?? options.requestId,
        });
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new AIServiceClientError(
          "Failed to parse JSON response from AI service",
          {
            status: 200,
            code: "INVALID_RESPONSE",
            isUnavailable: false,
            requestId: options.requestId,
            cause: parseErr,
          },
        );
      }

      const d = data as Record<string, unknown> | null;
      if (
        !d ||
        typeof d !== "object" ||
        typeof d.session_id !== "string" ||
        typeof d.score_out_of_100 !== "number" ||
        !Array.isArray(d.mcq_results) ||
        !Array.isArray(d.written_results) ||
        !Array.isArray(d.topic_breakdown)
      ) {
        throw new AIServiceClientError(
          "Invalid complete interview response schema from AI service",
          {
            status: 200,
            code: "INVALID_RESPONSE",
            isUnavailable: false,
            requestId: options.requestId,
          },
        );
      }

      return data as SessionCompletionReport;
    } catch (err) {
      if (err instanceof AIServiceClientError) {
        throw err;
      }

      const isTimeout =
        err instanceof Error &&
        (err.name === "AbortError" || controller.signal.aborted);

      throw new AIServiceClientError(
        isTimeout ? "Interview complete request timed out" : "AI service unreachable",
        {
          isUnavailable: true,
          code: isTimeout ? "TIMEOUT" : "UNAVAILABLE",
          status: isTimeout ? 504 : 503,
          requestId: options.requestId,
          cause: err,
        },
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

// Module-level singleton instance for server-side usage
export const aiServiceClient = new AIServiceClient();

/**
 * src/lib/rag.ts
 *
 * Retrieval-Augmented Generation (RAG) pipeline for the portfolio chatbot.
 * Powered by Google Gemini embeddings with cosine similarity.
 *
 * Exports:
 *   - Types: EmbeddingFunction, VectorStore, KnowledgeChunk, SearchResult,
 *            PortfolioSearchOptions, PortfolioSearchResponse, SerializedVectorIndex
 *   - chunkKnowledgeDocuments — split documents into overlapping chunks
 *   - validateEmbeddingVector — enforce vector dimension and finite number checks
 *   - InMemoryVectorStore     — cosine-similarity vector store with load/export
 *   - PgVectorStore           — optional Postgres/pgvector backend (768 dims)
 *   - getDefaultEmbeddingFunction — Gemini embedContent with RETRIEVAL_QUERY/RETRIEVAL_DOCUMENT
 *   - indexPortfolioKnowledge — embed + upsert all public portfolio docs
 *   - searchPortfolioKnowledge — search against precomputed/cached index without re-indexing
 *   - PortfolioIndexManager   — manages persistent index cache and concurrent init
 */

import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import {
  portfolioPublicDocuments,
  type KnowledgeDocument,
  type KnowledgeDocumentType,
} from "./knowledge-base";

// ============================================================
// CONSTANTS & TYPES
// ============================================================

export const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";
export const DEFAULT_EMBEDDING_DIMENSIONS = 768;

export type EmbeddingOptions = {
  taskType?: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT";
  title?: string;
  outputDimensionality?: number;
};

export type EmbeddingFunction = (
  text: string,
  options?: EmbeddingOptions,
) => Promise<number[]>;

export type VectorSearchOptions = {
  limit?: number;
  threshold?: number;
};

export type KnowledgeChunk = {
  id: string;
  documentId: string;
  source: string;
  type: KnowledgeDocumentType;
  title: string;
  summary: string;
  text: string;
  tags: readonly string[];
  metadata: Record<string, unknown> & {
    type: KnowledgeDocumentType;
    title: string;
    summary: string;
    source: string;
  };
};

export type SearchResult = KnowledgeChunk & {
  score: number;
};

export type StoredRecord = KnowledgeChunk & {
  vector: number[];
};

export type VectorStore = {
  upsert(chunks: KnowledgeChunk[], embedder: EmbeddingFunction): Promise<void>;
  search(
    query: string,
    options: VectorSearchOptions,
    embedder: EmbeddingFunction,
  ): Promise<SearchResult[]>;
  remove(documentId: string): Promise<void>;
  list(): Promise<SearchResult[]>;
  clear(): Promise<void>;
  loadRecords?(records: StoredRecord[]): void;
  exportRecords?(): StoredRecord[];
};

export type PortfolioSearchOptions = {
  vectorStore?: VectorStore;
  embedder?: EmbeddingFunction;
  documents?: readonly KnowledgeDocument[];
  limit?: number;
  maxChunkChars?: number;
  overlapChars?: number;
};

export type PortfolioSearchResponse = {
  results: SearchResult[];
  warning: string | null;
};

export type SerializedVectorIndex = {
  version: number;
  kbVersion?: string;
  model: string;
  dimensions: number;
  createdAt: string;
  recordsCount?: number;
  records: StoredRecord[];
};

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// ============================================================
// VECTOR VALIDATION
// Reject empty, malformed, non-finite, or dimension-mismatched vectors.
// ============================================================

export function validateEmbeddingVector(
  vector: unknown,
  expectedDimensions?: number,
): number[] {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("Invalid embedding: vector is empty or not an array.");
  }

  if (expectedDimensions !== undefined && vector.length !== expectedDimensions) {
    throw new Error(
      `Invalid embedding dimension: expected ${expectedDimensions}, got ${vector.length}.`,
    );
  }

  for (let i = 0; i < vector.length; i++) {
    const val = vector[i];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw new Error(
        `Invalid embedding value at index ${i}: value is non-finite or not a number.`,
      );
    }
  }

  return vector as number[];
}

// ============================================================
// CHUNKING
// Splits documents into overlapping text windows suitable for
// embedding. Overlap preserves context across chunk boundaries.
// ============================================================

export function chunkKnowledgeDocuments(
  documents: readonly KnowledgeDocument[],
  options: { maxChunkChars?: number; overlapChars?: number } = {},
): KnowledgeChunk[] {
  const maxChunkChars = options.maxChunkChars ?? 700;
  const overlapChars = options.overlapChars ?? 100;
  const chunks: KnowledgeChunk[] = [];

  for (const doc of documents) {
    const text = normalizeWhitespace(
      [doc.title, doc.summary, doc.content].join(" "),
    );

    if (text.length <= maxChunkChars) {
      chunks.push({
        id: `${doc.id}-0`,
        documentId: doc.id,
        source: doc.source,
        type: doc.type,
        title: doc.title,
        summary: doc.summary,
        text,
        tags: doc.tags,
        metadata: {
          ...doc.metadata,
          type: doc.type,
          title: doc.title,
          summary: doc.summary,
          source: doc.source,
        },
      });
      continue;
    }

    let offset = 0;
    let chunkIndex = 0;
    while (offset < text.length) {
      const end = Math.min(offset + maxChunkChars, text.length);
      const slice = text.slice(offset, end);
      chunks.push({
        id: `${doc.id}-${chunkIndex}`,
        documentId: doc.id,
        source: doc.source,
        type: doc.type,
        title: doc.title,
        summary: doc.summary,
        text: slice,
        tags: doc.tags,
        metadata: {
          ...doc.metadata,
          type: doc.type,
          title: doc.title,
          summary: doc.summary,
          source: doc.source,
        },
      });
      offset += maxChunkChars - overlapChars;
      chunkIndex++;
      if (end >= text.length) break;
    }
  }

  return chunks;
}

// ============================================================
// COSINE SIMILARITY
// ============================================================

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

function magnitude(v: number[]): number {
  let sum = 0;
  for (const x of v) sum += x * x;
  return Math.sqrt(sum);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

// ============================================================
// IN-MEMORY VECTOR STORE
// ============================================================

export class InMemoryVectorStore implements VectorStore {
  private readonly records = new Map<string, StoredRecord>();

  async upsert(
    chunks: KnowledgeChunk[],
    embedder: EmbeddingFunction,
  ): Promise<void> {
    for (const chunk of chunks) {
      const vector = await embedder(chunk.text, {
        taskType: "RETRIEVAL_DOCUMENT",
        title: chunk.title,
      });
      validateEmbeddingVector(vector);
      this.records.set(chunk.id, { ...chunk, vector });
    }
  }

  loadRecords(records: StoredRecord[]): void {
    for (const record of records) {
      validateEmbeddingVector(record.vector, DEFAULT_EMBEDDING_DIMENSIONS);
      this.records.set(record.id, record);
    }
  }

  exportRecords(): StoredRecord[] {
    const list: StoredRecord[] = [];
    this.records.forEach((record) => {
      list.push(record);
    });
    return list;
  }

  async search(
    query: string,
    options: VectorSearchOptions,
    embedder: EmbeddingFunction,
  ): Promise<SearchResult[]> {
    const limit = options.limit ?? 5;
    const threshold = options.threshold ?? 0;
    const queryVector = await embedder(query, {
      taskType: "RETRIEVAL_QUERY",
    });
    validateEmbeddingVector(queryVector);

    const results: SearchResult[] = [];
    this.records.forEach((record) => {
      const score = cosineSimilarity(queryVector, record.vector);
      if (score >= threshold) {
        const { vector: _v, ...chunk } = record;
        results.push({ ...chunk, score });
      }
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  async remove(documentId: string): Promise<void> {
    const toDelete: string[] = [];
    this.records.forEach((_record, id) => {
      if (id.startsWith(`${documentId}-`)) toDelete.push(id);
    });
    toDelete.forEach((id) => this.records.delete(id));
  }

  async list(): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    this.records.forEach((record) => {
      const { vector: _v, ...chunk } = record;
      results.push({ ...chunk, score: 1 });
    });
    return results;
  }

  async clear(): Promise<void> {
    this.records.clear();
  }

  size(): number {
    return this.records.size;
  }
}

// ============================================================
// PG VECTOR STORE
// Optional Postgres/pgvector backend. Dimensions updated to 768.
// ============================================================

type PgClientLike = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
};

export class PgVectorStore implements VectorStore {
  private readonly table: string;
  private readonly dimensions: number;
  private clientPromise: Promise<PgClientLike> | null = null;

  constructor(options: { table?: string; dimensions?: number } = {}) {
    this.table = options.table ?? "portfolio_chunks";
    this.dimensions = options.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS;
  }

  private async getClient(): Promise<PgClientLike> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        // eslint-disable-next-line no-new-func
        const pg = (await new Function("m", "return import(m)")("pg")) as {
          default?: { Client: new () => unknown };
          Client?: new () => unknown;
        };
        const Client = pg.default?.Client ?? pg.Client;
        if (!Client) throw new Error("pg module did not export a Client constructor.");
        const client = new Client() as PgClientLike;
        // @ts-expect-error dynamic pg client
        await (client as { connect(): Promise<void> }).connect();
        await client.query(`
          CREATE EXTENSION IF NOT EXISTS vector;
          CREATE TABLE IF NOT EXISTS ${this.table} (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            source TEXT NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            text TEXT NOT NULL,
            tags TEXT[] NOT NULL,
            metadata JSONB NOT NULL,
            vector vector(${this.dimensions}) NOT NULL
          );
          CREATE INDEX IF NOT EXISTS ${this.table}_vector_idx
            ON ${this.table} USING ivfflat (vector vector_cosine_ops);
        `);
        return client;
      })();
    }
    return this.clientPromise;
  }

  async upsert(
    chunks: KnowledgeChunk[],
    embedder: EmbeddingFunction,
  ): Promise<void> {
    const client = await this.getClient();
    for (const chunk of chunks) {
      const vector = await embedder(chunk.text, {
        taskType: "RETRIEVAL_DOCUMENT",
        title: chunk.title,
      });
      validateEmbeddingVector(vector, this.dimensions);
      await client.query(
        `INSERT INTO ${this.table}
           (id, document_id, source, type, title, summary, text, tags, metadata, vector)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET
           text = EXCLUDED.text,
           vector = EXCLUDED.vector,
           metadata = EXCLUDED.metadata`,
        [
          chunk.id,
          chunk.documentId,
          chunk.source,
          chunk.type,
          chunk.title,
          chunk.summary,
          chunk.text,
          chunk.tags,
          JSON.stringify(chunk.metadata),
          `[${vector.join(",")}]`,
        ],
      );
    }
  }

  async search(
    query: string,
    options: VectorSearchOptions,
    embedder: EmbeddingFunction,
  ): Promise<SearchResult[]> {
    const client = await this.getClient();
    const limit = options.limit ?? 5;
    const threshold = options.threshold ?? 0;
    const queryVector = await embedder(query, { taskType: "RETRIEVAL_QUERY" });
    validateEmbeddingVector(queryVector, this.dimensions);

    const response = await client.query(
      `SELECT *, 1 - (vector <=> $1::vector) AS score
       FROM ${this.table}
       WHERE 1 - (vector <=> $1::vector) >= $2
       ORDER BY score DESC
       LIMIT $3`,
      [`[${queryVector.join(",")}]`, threshold, limit],
    );

    return (response.rows ?? []).map((row) => ({
      id: String(row["id"] ?? ""),
      documentId: String(row["document_id"] ?? ""),
      source: String(row["source"] ?? ""),
      type: (row["type"] as KnowledgeDocumentType) ?? "profile",
      title: String(row["title"] ?? ""),
      summary: String(row["summary"] ?? ""),
      text: String(row["text"] ?? ""),
      tags: Array.isArray(row["tags"]) ? (row["tags"] as string[]) : [],
      metadata: {
        type: (row["type"] as KnowledgeDocumentType) ?? "profile",
        title: String(row["title"] ?? ""),
        summary: String(row["summary"] ?? ""),
        source: String(row["source"] ?? ""),
        ...(typeof row["metadata"] === "object" && row["metadata"] !== null
          ? (row["metadata"] as Record<string, unknown>)
          : {}),
      },
      score: typeof row["score"] === "number" ? row["score"] : 0,
    }));
  }

  async remove(documentId: string): Promise<void> {
    const client = await this.getClient();
    await client.query(`DELETE FROM ${this.table} WHERE document_id = $1`, [
      documentId,
    ]);
  }

  async list(): Promise<SearchResult[]> {
    const client = await this.getClient();
    const response = await client.query(
      `SELECT *, 1 AS score FROM ${this.table}`,
    );
    return (response.rows ?? []).map((row) => ({
      id: String(row["id"] ?? ""),
      documentId: String(row["document_id"] ?? ""),
      source: String(row["source"] ?? ""),
      type: (row["type"] as KnowledgeDocumentType) ?? "profile",
      title: String(row["title"] ?? ""),
      summary: String(row["summary"] ?? ""),
      text: String(row["text"] ?? ""),
      tags: Array.isArray(row["tags"]) ? (row["tags"] as string[]) : [],
      metadata: {
        type: (row["type"] as KnowledgeDocumentType) ?? "profile",
        title: String(row["title"] ?? ""),
        summary: String(row["summary"] ?? ""),
        source: String(row["source"] ?? ""),
        ...(typeof row["metadata"] === "object" && row["metadata"] !== null
          ? (row["metadata"] as Record<string, unknown>)
          : {}),
      },
      score: 1,
    }));
  }

  async clear(): Promise<void> {
    const client = await this.getClient();
    await client.query(`DELETE FROM ${this.table}`);
  }
}

// ============================================================
// GOOGLE GEMINI EMBEDDING FUNCTION
// Uses Google Gen AI SDK (@google/genai) embedContent.
// Validates return dimensions, non-empty, and finite numbers.
// ============================================================

export function getDefaultEmbeddingFunction(config: {
  apiKey?: string;
  model?: string;
  outputDimensionality?: number;
  client?: GoogleGenAI;
} = {}): EmbeddingFunction {
  const apiKey = config.apiKey ?? process.env.GEMINI_API_KEY;
  const model =
    config.model ??
    process.env.GEMINI_EMBEDDING_MODEL ??
    DEFAULT_EMBEDDING_MODEL;
  const outputDimensionality =
    config.outputDimensionality ?? DEFAULT_EMBEDDING_DIMENSIONS;

  let ai = config.client;
  if (!ai && apiKey) {
    ai = new GoogleGenAI({ apiKey });
  }

  return async (
    text: string,
    options: EmbeddingOptions = {},
  ): Promise<number[]> => {
    if (!ai) {
      throw new Error(
        "GEMINI_API_KEY is not set. Cannot embed text without a Gemini API key.",
      );
    }

    try {
      const response = await ai.models.embedContent({
        model,
        contents: text,
        config: {
          taskType: options.taskType ?? "RETRIEVAL_QUERY",
          title: options.title,
          outputDimensionality,
        },
      });

      const values = response.embeddings?.[0]?.values;

      if (!values || !Array.isArray(values) || values.length === 0) {
        throw new Error("Gemini returned an empty or missing embedding vector.");
      }

      return validateEmbeddingVector(values, outputDimensionality);
    } catch (err) {
      if (err instanceof Error) {
        // Redact any raw query strings or key echoes if present
        const cleanMsg = err.message.replace(/key=[^&\s]+/gi, "key=REDACTED");
        throw new Error(`Gemini Embeddings error: ${cleanMsg}`);
      }
      throw new Error("Gemini Embeddings error: Unknown failure.");
    }
  };
}

// ============================================================
// PERSISTENT INDEX CACHE & LIFECYCLE MANAGER
//
// Solves Critical Requirement #6:
// - Does NOT re-embed knowledge chunks on every user message.
// - Reuses precomputed index file (src/data/rag-index.json).
// - Protects concurrent requests with initialization mutex.
// ============================================================

export const INDEX_FILE_PATH = path.join(
  process.cwd(),
  "src",
  "data",
  "rag-index.json",
);

export class PortfolioIndexManager {
  private static instance: PortfolioIndexManager | null = null;
  private readonly store: InMemoryVectorStore;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.store = new InMemoryVectorStore();
  }

  static getInstance(): PortfolioIndexManager {
    if (!PortfolioIndexManager.instance) {
      PortfolioIndexManager.instance = new PortfolioIndexManager();
    }
    return PortfolioIndexManager.instance;
  }

  getStore(): InMemoryVectorStore {
    return this.store;
  }

  isInitialized(): boolean {
    return this.initialized && this.store.size() > 0;
  }

  /**
   * Initialize the vector store from precomputed file or on-demand embedder.
   * Concurrency-safe: multiple parallel calls share the same Promise.
   */
  async initialize(options: {
    force?: boolean;
    embedder?: EmbeddingFunction;
    filePath?: string;
  } = {}): Promise<void> {
    if (this.isInitialized() && !options.force) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        const filePath = options.filePath ?? INDEX_FILE_PATH;

        const expectedModel =
          process.env.GEMINI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
        const expectedDimensions = DEFAULT_EMBEDDING_DIMENSIONS;

        // 1. Try loading from persistent file
        if (!options.force && fs.existsSync(filePath)) {
          let parsed: SerializedVectorIndex | null = null;
          try {
            const raw = fs.readFileSync(filePath, "utf8");
            parsed = JSON.parse(raw) as SerializedVectorIndex;
          } catch (readErr) {
            console.warn(
              `[rag] Failed to parse vector index at ${filePath}:`,
              readErr,
            );
          }

          if (parsed) {
            const isModelMatch = parsed.model === expectedModel;
            const isDimMatch = parsed.dimensions === expectedDimensions;
            const hasRecords =
              Array.isArray(parsed.records) && parsed.records.length > 0;

            if (isModelMatch && isDimMatch && hasRecords) {
              this.store.clear();
              this.store.loadRecords(parsed.records);
              this.initialized = true;
              return;
            }

            const reason = !isModelMatch
              ? `model mismatch (expected: ${expectedModel}, found: ${parsed.model})`
              : !isDimMatch
                ? `dimensions mismatch (expected: ${expectedDimensions}, found: ${parsed.dimensions})`
                : "index contains no valid records";

            console.warn(
              `[rag] Incompatible or stale vector index at ${filePath}: ${reason}. Run 'npm run index:kb' to rebuild the index.`,
            );

            // If no embedder or API key is available to recompute on-demand, throw actionable error
            if (!options.embedder && !process.env.GEMINI_API_KEY) {
              throw new Error(
                `Incompatible vector index at ${filePath} (${reason}). Please run 'npm run index:kb' to rebuild the knowledge base index.`,
              );
            }
          }
        }

        // 2. Build on-demand if embedder or API key is available
        const embedder = options.embedder ?? getDefaultEmbeddingFunction();
        const chunks = chunkKnowledgeDocuments(portfolioPublicDocuments);

        this.store.clear();
        await this.store.upsert(chunks, embedder);
        this.initialized = true;

        // 3. Try to save to file for subsequent invocations
        try {
          const serialized: SerializedVectorIndex = {
            version: 1,
            kbVersion: "2026.1",
            model: expectedModel,
            dimensions: expectedDimensions,
            createdAt: new Date().toISOString(),
            recordsCount: this.store.size(),
            records: this.store.exportRecords(),
          };
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(filePath, JSON.stringify(serialized, null, 2), "utf8");
        } catch {
          // If filesystem is read-only (e.g. serverless edge), in-memory store is still active
        }
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  reset(): void {
    this.store.clear();
    this.initialized = false;
    this.initPromise = null;
  }
}

// ============================================================
// HIGH-LEVEL API
// ============================================================

/**
 * Embed and upsert all public portfolio documents into a vector store.
 * Used by scripts/index-knowledge.ts or custom vector store setups.
 */
export async function indexPortfolioKnowledge(
  options: PortfolioSearchOptions = {},
): Promise<KnowledgeChunk[]> {
  const vectorStore = options.vectorStore ?? new InMemoryVectorStore();
  const embedder = options.embedder ?? getDefaultEmbeddingFunction();
  const documents = options.documents ?? portfolioPublicDocuments;
  const chunks = chunkKnowledgeDocuments(documents, {
    maxChunkChars: options.maxChunkChars ?? 700,
    overlapChars: options.overlapChars ?? 100,
  });

  await vectorStore.upsert(chunks, embedder);
  return chunks;
}

/**
 * One-shot search:
 * - If a custom vectorStore is provided (e.g. in tests), queries it.
 * - Otherwise, queries the pre-indexed PortfolioIndexManager singleton.
 * - Embeds ONLY the user query (never regenerates the whole index on user queries).
 */
export async function searchPortfolioKnowledge(
  query: string,
  options: PortfolioSearchOptions = {},
): Promise<PortfolioSearchResponse> {
  const trimmed = query.trim();

  if (!trimmed) {
    return { results: [], warning: "No question was provided." };
  }

  const limit = options.limit ?? 5;

  // Custom vector store passed (e.g., in unit tests)
  if (options.vectorStore) {
    const embedder = options.embedder ?? getDefaultEmbeddingFunction();
    const results = await options.vectorStore.search(
      trimmed,
      { limit, threshold: 0.1 },
      embedder,
    );

    if (results.length === 0) {
      return {
        results: [],
        warning: "No relevant portfolio information was found for this query.",
      };
    }

    return { results, warning: null };
  }

  // Production flow: Use persistent/singleton index manager
  const indexManager = PortfolioIndexManager.getInstance();
  if (!indexManager.isInitialized()) {
    await indexManager.initialize({ embedder: options.embedder });
  }

  const store = indexManager.getStore();
  const embedder = options.embedder ?? getDefaultEmbeddingFunction();

  try {
    const results = await store.search(
      trimmed,
      { limit, threshold: 0.1 },
      embedder,
    );

    if (results.length === 0) {
      return {
        results: [],
        warning: "No relevant portfolio information was found for this query.",
      };
    }

    return { results, warning: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`RAG pipeline error: ${msg}`);
  }
}

// Re-export the base type so consumers can import from rag only
export type { KnowledgeDocument, KnowledgeDocumentType };

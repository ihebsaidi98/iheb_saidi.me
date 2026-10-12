/**
 * src/lib/rag.ts
 *
 * Retrieval-Augmented Generation (RAG) pipeline for the portfolio chatbot.
 *
 * Exports:
 *   - Types: EmbeddingFunction, VectorStore, KnowledgeChunk, SearchResult,
 *            PortfolioSearchOptions, PortfolioSearchResponse
 *   - chunkKnowledgeDocuments — split documents into overlapping chunks
 *   - InMemoryVectorStore     — cosine-similarity vector store (no DB needed)
 *   - PgVectorStore           — optional Postgres/pgvector backend
 *   - indexPortfolioKnowledge — embed + upsert all public portfolio docs
 *   - searchPortfolioKnowledge — one-shot: embed query + retrieve top-K chunks
 *   - getDefaultEmbeddingFunction — OpenAI text-embedding-3-small via fetch
 */

import { portfolioKnowledgeBase, portfolioPublicDocuments, type KnowledgeDocument, type KnowledgeDocumentType } from "./knowledge-base";

export type EmbeddingFunction = (text: string) => Promise<number[]>;

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

export type VectorStore = {
  upsert(chunks: KnowledgeChunk[], embedder: EmbeddingFunction): Promise<void>;
  search(query: string, options: VectorSearchOptions, embedder: EmbeddingFunction): Promise<SearchResult[]>;
  remove(documentId: string): Promise<void>;
  list(): Promise<SearchResult[]>;
  clear(): Promise<void>;
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

type StoredRecord = KnowledgeChunk & {
  vector: number[];
};

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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
// Suitable for development and small portfolios.
// State is per-process (rebuilt on cold start).
// ============================================================

export class InMemoryVectorStore implements VectorStore {
  private readonly records = new Map<string, StoredRecord>();

  async upsert(chunks: KnowledgeChunk[], embedder: EmbeddingFunction): Promise<void> {
    await Promise.all(
      chunks.map(async (chunk) => {
        const vector = await embedder(chunk.text);
        this.records.set(chunk.id, { ...chunk, vector });
      }),
    );
  }

  async search(
    query: string,
    options: VectorSearchOptions,
    embedder: EmbeddingFunction,
  ): Promise<SearchResult[]> {
    const limit = options.limit ?? 5;
    const threshold = options.threshold ?? 0;
    const queryVector = await embedder(query);

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
}

// ============================================================
// PG VECTOR STORE
// Optional Postgres/pgvector backend. Only activated when
// the caller passes an instance — never imported at module load.
// The `pg` module is dynamically imported so it does not affect
// builds or runtimes that don't have it installed.
// ============================================================

type PgClientLike = {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

export class PgVectorStore implements VectorStore {
  private readonly table: string;
  private readonly dimensions: number;
  private clientPromise: Promise<PgClientLike> | null = null;

  constructor(options: { table?: string; dimensions?: number } = {}) {
    this.table = options.table ?? "portfolio_chunks";
    this.dimensions = options.dimensions ?? 1536;
  }

  private async getClient(): Promise<PgClientLike> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        // Use an indirect require so TypeScript does not attempt to resolve
        // the "pg" module statically — it may not be installed in all envs.
        // eslint-disable-next-line no-new-func
        const pg = await (new Function('m', 'return import(m)'))('pg') as { default?: { Client: new () => unknown }; Client?: new () => unknown };
        const Client = pg.default?.Client ?? pg.Client;
        if (!Client) throw new Error("pg module did not export a Client constructor.");
        const client = new Client() as PgClientLike;
        // @ts-expect-error — dynamic pg client type
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

  async upsert(chunks: KnowledgeChunk[], embedder: EmbeddingFunction): Promise<void> {
    const client = await this.getClient();
    await Promise.all(
      chunks.map(async (chunk) => {
        const vector = await embedder(chunk.text);
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
      }),
    );
  }

  async search(
    query: string,
    options: VectorSearchOptions,
    embedder: EmbeddingFunction,
  ): Promise<SearchResult[]> {
    const client = await this.getClient();
    const limit = options.limit ?? 5;
    const threshold = options.threshold ?? 0;
    const queryVector = await embedder(query);

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
    await client.query(
      `DELETE FROM ${this.table} WHERE document_id = $1`,
      [documentId],
    );
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
// OPENAI EMBEDDING
// Uses text-embedding-3-small (1536 dims).
// Only called server-side — key is never exposed to the client.
// ============================================================

export function getDefaultEmbeddingFunction(): EmbeddingFunction {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

  return async (text: string): Promise<number[]> => {
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Cannot embed text without an API key.",
      );
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text, model }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Embeddings API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const embedding = data?.data?.[0]?.embedding;

    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("OpenAI returned an empty embedding.");
    }

    return embedding;
  };
}

// ============================================================
// HIGH-LEVEL API
// These are the primary entry points used by route.ts.
// ============================================================

/**
 * Embed and upsert all public portfolio documents into a vector store.
 * Returns the list of chunks that were indexed.
 */
export async function indexPortfolioKnowledge(options: PortfolioSearchOptions = {}): Promise<KnowledgeChunk[]> {
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
 * One-shot search: embed the query, retrieve top-K relevant chunks.
 * Handles empty queries and zero-result cases with a warning string.
 */
export async function searchPortfolioKnowledge(
  query: string,
  options: PortfolioSearchOptions = {},
): Promise<PortfolioSearchResponse> {
  const trimmed = query.trim();

  if (!trimmed) {
    return { results: [], warning: "No question was provided." };
  }

  const vectorStore = options.vectorStore ?? new InMemoryVectorStore();
  const embedder = options.embedder ?? getDefaultEmbeddingFunction();
  const limit = options.limit ?? 5;

  try {
    await vectorStore.upsert(
      chunkKnowledgeDocuments(options.documents ?? portfolioPublicDocuments, {
        maxChunkChars: options.maxChunkChars ?? 700,
        overlapChars: options.overlapChars ?? 100,
      }),
      embedder,
    );

    const results = await vectorStore.search(trimmed, { limit, threshold: 0.1 }, embedder);

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

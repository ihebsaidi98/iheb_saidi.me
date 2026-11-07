import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  chunkKnowledgeDocuments,
  InMemoryVectorStore,
  searchPortfolioKnowledge,
  validateEmbeddingVector,
  PortfolioIndexManager,
  CURRENT_STRATEGY_VERSION,
  type EmbeddingFunction,
  type SerializedVectorIndex,
} from "./rag";
import { formatRetrievedContext, formatUserPrompt } from "./chat";
import type { KnowledgeDocument } from "./knowledge-base";

const sampleDocuments: KnowledgeDocument[] = [
  {
    id: "doc-profile",
    type: "profile",
    title: "Profile",
    summary: "Profile summary",
    content:
      "Iheb Saidi is a senior full-stack engineer with deep experience in Java, Spring Boot, TypeScript, and AI workflows.",
    source: "src/data/profile.ts",
    tags: ["profile", "java", "spring boot"],
    metadata: {
      visibility: "public",
      location: "Tunis, Tunisia",
    },
    public: true,
  },
  {
    id: "doc-project",
    type: "project",
    title: "Portfolio platform",
    summary: "Built a portfolio platform with product thinking and AI features.",
    content:
      "This project shipped a Next.js portfolio site with TypeScript, authentication flows, and system monitoring for internal teams.",
    source: "src/data/projects.ts",
    tags: ["project", "next js", "typescript"],
    metadata: {
      company: "Independent",
      role: "Lead engineer",
      visibility: "public",
    },
    public: true,
  },
];

const fakeEmbedding = async (text: string) => {
  const lower = text.toLowerCase();
  const vector = [0, 0, 0, 0];
  if (lower.includes("spring")) vector[0] = 1;
  if (lower.includes("java")) vector[1] = 1;
  if (lower.includes("typescript")) vector[2] = 1;
  if (lower.includes("portfolio")) vector[3] = 1;
  return vector;
};

describe("rag pipeline", () => {
  it("chunks documents while preserving source metadata", () => {
    const longDocument: KnowledgeDocument = {
      ...sampleDocuments[0],
      content:
        "Sentence one. Sentence two. Sentence three. Sentence four. Sentence five. Sentence six. Sentence seven.",
    };

    const chunks = chunkKnowledgeDocuments([longDocument], { maxChunkChars: 80, overlapChars: 20 });

    assert.ok(chunks.length > 1);
    assert.equal(chunks[0].source, "src/data/profile.ts");
    assert.equal(chunks[0].metadata.type, "profile");
    assert.ok(chunks[0].text.length <= 80 + 20);
  });

  it("indexes documents without duplicate records", async () => {
    const store = new InMemoryVectorStore();
    const chunks = chunkKnowledgeDocuments(sampleDocuments, { maxChunkChars: 200, overlapChars: 20 });

    await store.upsert(chunks, fakeEmbedding);
    await store.upsert(chunks, fakeEmbedding);

    const records = await store.list();
    assert.equal(records.length, chunks.length);
  });

  it("retrieves the most relevant chunks with source metadata", async () => {
    const store = new InMemoryVectorStore();
    const chunks = chunkKnowledgeDocuments(sampleDocuments, { maxChunkChars: 200, overlapChars: 10 });

    await store.upsert(chunks, fakeEmbedding);

    const result = await store.search("spring boot java experience", { limit: 3 }, fakeEmbedding);

    assert.ok(result.length > 0);
    assert.equal(result[0].source, "src/data/profile.ts");
    assert.equal(result[0].metadata.type, "profile");
  });

  it("returns empty results for empty queries or unavailable matches", async () => {
    const store = new InMemoryVectorStore();

    const emptyResult = await searchPortfolioKnowledge("   ", { vectorStore: store, embedder: fakeEmbedding });
    assert.deepEqual(emptyResult, {
      results: [],
      warning: "No question was provided.",
    });

    await store.upsert(chunkKnowledgeDocuments(sampleDocuments, { maxChunkChars: 200, overlapChars: 10 }), fakeEmbedding);
    const result = await searchPortfolioKnowledge("completely unrelated query xyz", {
      vectorStore: store,
      embedder: fakeEmbedding,
      limit: 5,
    });

    assert.equal(result.results.length, 0);
    assert.match(result.warning ?? "", /No relevant/);
  });
});

describe("vector validation", () => {
  it("accepts valid vector of expected dimensions", () => {
    const vec = [0.1, 0.2, -0.5, 0.9];
    const validated = validateEmbeddingVector(vec, 4);
    assert.deepEqual(validated, vec);
  });

  it("rejects non-array or empty vector", () => {
    assert.throws(() => validateEmbeddingVector(null), /empty or not an array/);
    assert.throws(() => validateEmbeddingVector([]), /empty or not an array/);
    assert.throws(() => validateEmbeddingVector("vector"), /empty or not an array/);
  });

  it("rejects dimension mismatch", () => {
    assert.throws(() => validateEmbeddingVector([1, 2, 3], 4), /dimension: expected 4, got 3/);
    assert.throws(() => validateEmbeddingVector([1, 2, 3, 4, 5], 4), /dimension: expected 4, got 5/);
  });

  it("rejects non-finite values (NaN, Infinity, -Infinity)", () => {
    assert.throws(() => validateEmbeddingVector([1, NaN, 3]), /non-finite/);
    assert.throws(() => validateEmbeddingVector([1, Infinity, 3]), /non-finite/);
    assert.throws(() => validateEmbeddingVector([1, -Infinity, 3]), /non-finite/);
    assert.throws(() => validateEmbeddingVector([1, "string" as unknown as number, 3]), /non-finite/);
  });
});

describe("PortfolioIndexManager & persistent index lifecycle", () => {
  function createTempIndex(overrides: Partial<SerializedVectorIndex> = {}): { dir: string; filePath: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rag-index-lifecycle-test-"));
    const filePath = path.join(dir, "rag-index.json");
    const payload: SerializedVectorIndex = {
      version: 1,
      strategyVersion: CURRENT_STRATEGY_VERSION,
      kbVersion: "2026.1",
      model: "gemini-embedding-001",
      dimensions: 768,
      createdAt: new Date().toISOString(),
      recordsCount: 1,
      records: [
        {
          id: "profile-overview-0",
          documentId: "profile-overview",
          source: "src/data/profile.ts",
          type: "profile",
          title: "Iheb Saidi — Professional Profile",
          summary: "Profile summary",
          text: "Iheb Saidi is a software engineer.",
          searchText: "Iheb Saidi profile Iheb Saidi is a software engineer.",
          tags: ["profile"],
          metadata: {
            visibility: "public",
            type: "profile",
            title: "Iheb Saidi — Professional Profile",
            summary: "Profile summary",
            source: "src/data/profile.ts",
          },
          vector: new Array(768).fill(0.01),
        },
      ],
      ...overrides,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload), "utf8");
    return { dir, filePath };
  }

  it("initializes from compatible precomputed index file without calling embedder", async () => {
    const { dir, filePath } = createTempIndex();
    try {
      const manager = new PortfolioIndexManager();
      await manager.initialize({ filePath });

      assert.equal(manager.isInitialized(), true);
      assert.equal(manager.getStore().size(), 1);

      // Perform search using sample vector without embedder
      const sampleVector = manager.getStore().exportRecords?.()[0]?.vector!;
      const results = await manager.getStore().search("Java", { limit: 1 }, async () => sampleVector);
      assert.equal(results.length, 1);
      assert.equal(results[0]?.id, "profile-overview-0");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("handles concurrent initialization safely without duplicate work", async () => {
    const { dir, filePath } = createTempIndex();
    try {
      const manager = new PortfolioIndexManager();
      await Promise.all([
        manager.initialize({ filePath }),
        manager.initialize({ filePath }),
        manager.initialize({ filePath }),
      ]);
      assert.equal(manager.isInitialized(), true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("generates stable chunk IDs across runs", () => {
    const chunks1 = chunkKnowledgeDocuments(sampleDocuments, { maxChunkChars: 100, overlapChars: 10 });
    const chunks2 = chunkKnowledgeDocuments(sampleDocuments, { maxChunkChars: 100, overlapChars: 10 });

    assert.equal(chunks1.length, chunks2.length);
    for (let i = 0; i < chunks1.length; i++) {
      assert.equal(chunks1[i]?.id, chunks2[i]?.id);
      assert.equal(chunks1[i]?.documentId, chunks2[i]?.documentId);
    }
  });

  it("detects incompatible index dimensions and provides actionable error", async () => {
    const { dir, filePath } = createTempIndex({ dimensions: 1536 });
    try {
      const manager = new PortfolioIndexManager();
      await assert.rejects(
        () => manager.initialize({ filePath }),
        /dimensions mismatch \(expected: 768, found: 1536\)/,
      );
      assert.equal(manager.isInitialized(), false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects incompatible embedding model and provides actionable error", async () => {
    const { dir, filePath } = createTempIndex({ model: "text-embedding-3-small" });
    try {
      const manager = new PortfolioIndexManager();
      await assert.rejects(
        () => manager.initialize({ filePath }),
        /model mismatch \(expected: gemini-embedding-001, found: text-embedding-3-small\)/,
      );
      assert.equal(manager.isInitialized(), false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects legacy index without strategyVersion and refuses silent loading", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rag-legacy-test-"));
    const tempIndex = path.join(tempDir, "rag-index.json");
    try {
      // Index without strategyVersion (exactly like the legacy pre-Phase 3 index on disk)
      fs.writeFileSync(
        tempIndex,
        JSON.stringify({
          version: 1,
          model: "gemini-embedding-001",
          dimensions: 768,
          createdAt: "2026-10-31T20:31:08.883Z",
          records: [{ id: "legacy-0", vector: new Array(768).fill(0.01) }],
        }),
      );

      const manager = new PortfolioIndexManager();
      await assert.rejects(
        () => manager.initialize({ filePath: tempIndex }),
        /strategy version mismatch \(expected: 2, found: none\)/,
      );
      // Confirms stale vectors were never loaded
      assert.equal(manager.isInitialized(), false);
      assert.equal(manager.getStore().size(), 0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects index with incompatible strategyVersion", async () => {
    const { dir, filePath } = createTempIndex({ strategyVersion: 1 });
    try {
      const manager = new PortfolioIndexManager();
      await assert.rejects(
        () => manager.initialize({ filePath }),
        /strategy version mismatch \(expected: 2, found: 1\)/,
      );
      assert.equal(manager.isInitialized(), false);
      assert.equal(manager.getStore().size(), 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects missing index file without triggering implicit Gemini network calls", async () => {
    const manager = new PortfolioIndexManager();
    await assert.rejects(
      () => manager.initialize({ filePath: "/tmp/non-existent-rag-index-test.json" }),
      /Missing vector index at/,
    );
    assert.equal(manager.isInitialized(), false);
  });

  it("persists strategyVersion when initializing with on-demand custom embedder", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rag-ondemand-test-"));
    const tempIndex = path.join(tempDir, "rag-index.json");
    try {
      const manager = new PortfolioIndexManager();
      const testEmbedder = async () => new Array(768).fill(0.05);
      await manager.initialize({ filePath: tempIndex, embedder: testEmbedder, force: true });

      assert.equal(manager.isInitialized(), true);
      assert.ok(fs.existsSync(tempIndex));
      const saved = JSON.parse(fs.readFileSync(tempIndex, "utf8"));
      assert.equal(saved.strategyVersion, CURRENT_STRATEGY_VERSION);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects force: true without explicit embedder to prevent implicit Gemini calls", async () => {
    const { dir, filePath } = createTempIndex();
    try {
      const manager = new PortfolioIndexManager();
      await assert.rejects(
        () => manager.initialize({ filePath, force: true }),
        /Cannot rebuild vector index on-demand without an explicit embedder/,
      );
      assert.equal(manager.isInitialized(), false);
      assert.equal(manager.getStore().size(), 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("initialization failure guarantees store remains empty and isInitialized is false", async () => {
    const manager = new PortfolioIndexManager();
    const failingEmbedder = async () => {
      throw new Error("Simulated embedder failure");
    };
    await assert.rejects(
      () => manager.initialize({ embedder: failingEmbedder, force: true }),
      /Simulated embedder failure/,
    );
    assert.equal(manager.isInitialized(), false);
    assert.equal(manager.getStore().size(), 0);
  });
});

describe("Phase 3 — Documentary context enrichment & metadata grounding", () => {
  it("preserves original chunk text and identifiers while enriching searchText", () => {
    const doc: KnowledgeDocument = {
      id: "academic-sample",
      type: "project",
      title: "Real-Time Auction Platform — ESPRIT",
      summary: "Distributed microservices auction system.",
      content: "Detailed description of the auction system built with Spring Boot and Angular.",
      source: "src/data/projects.ts",
      tags: ["project", "academic", "esprit-ariana", "auction-platform"],
      metadata: { company: "ESPRIT", visibility: "public" },
      public: true,
    };

    const chunks = chunkKnowledgeDocuments([doc]);
    assert.equal(chunks.length, 1);
    const chunk = chunks[0];

    // IDs and properties are preserved
    assert.equal(chunk.id, "academic-sample-0");
    assert.equal(chunk.documentId, "academic-sample");
    assert.equal(chunk.type, "project");
    assert.equal(chunk.title, "Real-Time Auction Platform — ESPRIT");

    // Original text is preserved (no technical tag injection)
    assert.doesNotMatch(chunk.text, /academic/i);

    // Search text integrates the academic tag for embedding
    assert.ok(chunk.searchText);
    assert.match(chunk.searchText, /\bacademic\b/);
    assert.match(chunk.searchText, /auction-platform/);
    assert.match(chunk.searchText, /Spring Boot/);
  });

  it("propagates parent document title to multi-chunk slices in searchText", () => {
    const longContent = "Long passage for section. ".repeat(40);
    const doc: KnowledgeDocument = {
      id: "novatek-platform",
      type: "project",
      title: "Novatek Platform",
      summary: "Industrial supervision platform.",
      content: longContent,
      source: "src/data/projects.ts",
      tags: ["project", "novatek", "industrial"],
      metadata: { company: "Novatek", visibility: "public" },
      public: true,
    };

    const chunks = chunkKnowledgeDocuments([doc], { maxChunkChars: 300, overlapChars: 50 });
    assert.ok(chunks.length > 1);

    // Chunk > 0 text does not have the title
    const chunk1 = chunks[1];
    assert.ok(!chunk1.text.startsWith("Novatek Platform"));

    // But chunk1.searchText contains the parent title and tags
    assert.ok(chunk1.searchText);
    assert.match(chunk1.searchText, /Novatek Platform/);
    assert.match(chunk1.searchText, /\bnovatek\b/);
    // Original chunk text is preserved in chunk.text
    assert.equal(chunk1.text.includes("Novatek Platform"), false);
  });

  it("handles documents with empty or missing optional metadata cleanly", () => {
    const docWithoutTags: KnowledgeDocument = {
      id: "minimal-doc",
      type: "meta",
      title: "Minimal Title",
      summary: "Minimal summary",
      content: "Bare minimum content with no tags.",
      source: "src/data/meta.ts",
      tags: [],
      metadata: {},
      public: true,
    };

    const chunks = chunkKnowledgeDocuments([docWithoutTags]);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0].searchText);
    assert.doesNotMatch(chunks[0].searchText, /undefined|null/);
    assert.match(chunks[0].searchText, /Minimal Title/);
  });

  it("InMemoryVectorStore uses searchText for embedding but returns original chunk.text", async () => {
    const doc: KnowledgeDocument = {
      id: "doc-context-test",
      type: "project",
      title: "Contextual Project Title",
      summary: "Summary of project",
      content: "Content talking about specialized microservices.",
      source: "src/data/projects.ts",
      tags: ["special-tag-keyword"],
      metadata: { visibility: "public" },
      public: true,
    };

    const chunks = chunkKnowledgeDocuments([doc]);
    const store = new InMemoryVectorStore();

    let embeddedText = "";
    const testEmbedder: EmbeddingFunction = async (text: string) => {
      embeddedText = text;
      return [1, 0];
    };

    await store.upsert(chunks, testEmbedder);

    // Vector store embedded the enriched searchText
    assert.match(embeddedText, /special-tag-keyword/);
    assert.match(embeddedText, /Contextual Project Title/);

    // But search returns chunk with original text
    const results = await store.search("special-tag-keyword", { limit: 1 }, async () => [1, 0]);
    assert.equal(results.length, 1);
    assert.equal(results[0].text, chunks[0].text);
    assert.doesNotMatch(results[0].text, /special-tag-keyword/);
  });

  it("formatRetrievedContext constructs LLM prompt strictly from chunk.text without metadata leakage", () => {
    const doc: KnowledgeDocument = {
      id: "leak-test-doc",
      type: "project",
      title: "Sample Project Title",
      summary: "Sample project summary",
      content: "This is the pure human-readable text for the user and LLM.",
      source: "src/data/projects.ts",
      tags: ["tag-alpha", "tag-beta", "technical-tag-gamma"],
      metadata: { role: "Architect", school: "PrivateInstitute" },
      public: true,
    };

    const chunks = chunkKnowledgeDocuments([doc]);
    const chunk = chunks[0];

    // Verify searchText has tags and metadata
    assert.ok(chunk.searchText);
    assert.match(chunk.searchText, /technical-tag-gamma/);
    assert.match(chunk.searchText, /tag-alpha/);

    // Format for LLM prompt
    const formatted = formatRetrievedContext(chunks);

    // Verified: format uses title, type, and text only
    assert.equal(
      formatted,
      `[1] ${chunk.title} (${chunk.type})\n${chunk.text}`,
    );
    // Verified: No searchText, no tags, no metadata leak into the prompt
    assert.doesNotMatch(formatted, /tag-alpha/);
    assert.doesNotMatch(formatted, /technical-tag-gamma/);
    assert.doesNotMatch(formatted, /PrivateInstitute/);

    // Verified: Full user prompt wraps retrieved context safely
    const userPrompt = formatUserPrompt("Tell me about the project", chunks);
    assert.ok(userPrompt.includes("<retrieved_context>"));
    assert.ok(userPrompt.includes("Question: Tell me about the project"));
    assert.doesNotMatch(userPrompt, /technical-tag-gamma/);
  });

  it("scripts/index-knowledge.ts is configured to embed chunk.searchText and persist strategyVersion", () => {
    const scriptPath = path.join(process.cwd(), "scripts", "index-knowledge.ts");
    assert.ok(fs.existsSync(scriptPath));
    const scriptContent = fs.readFileSync(scriptPath, "utf8");

    // Vectorizes enriched searchText
    assert.match(scriptContent, /chunk\.searchText\s*\?\?\s*chunk\.text/);
    // Writes CURRENT_STRATEGY_VERSION
    assert.match(scriptContent, /strategyVersion:\s*CURRENT_STRATEGY_VERSION/);
  });
});

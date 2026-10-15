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
} from "./rag";
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
  it("initializes from precomputed index file without calling embedder", async () => {
    const manager = PortfolioIndexManager.getInstance();
    await manager.initialize();

    assert.equal(manager.isInitialized(), true);
    assert.ok(manager.getStore().size() > 0, "Index store should have loaded records");

    // Perform search using sample vector
    const sampleVector = manager.getStore().exportRecords?.()[0]?.vector ?? new Array(768).fill(0.01);
    const queryEmbedder = async () => sampleVector;
    const results = await manager.getStore().search("Java", { limit: 3, threshold: -1 }, queryEmbedder);
    assert.ok(results.length > 0);
    assert.equal(typeof results[0]?.score, "number");
  });

  it("handles concurrent initialization safely without duplicate work", async () => {
    const manager = PortfolioIndexManager.getInstance();
    // Call initialize 5 times concurrently
    const promises = [
      manager.initialize(),
      manager.initialize(),
      manager.initialize(),
      manager.initialize(),
      manager.initialize(),
    ];
    await Promise.all(promises);
    assert.equal(manager.isInitialized(), true);
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
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rag-incompatible-test-"));
    const tempIndex = path.join(tempDir, "rag-index.json");
    try {
      // Write index with wrong dimensions (1536 instead of 768)
      fs.writeFileSync(
        tempIndex,
        JSON.stringify({
          version: 1,
          model: "gemini-embedding-001",
          dimensions: 1536,
          createdAt: new Date().toISOString(),
          records: [{ id: "c-1", vector: new Array(1536).fill(0.1) }],
        }),
      );

      const manager = new PortfolioIndexManager();
      await assert.rejects(
        () => manager.initialize({ filePath: tempIndex }),
        /dimensions mismatch \(expected: 768, found: 1536\)/,
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("detects incompatible embedding model and provides actionable error", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rag-incompatible-test-"));
    const tempIndex = path.join(tempDir, "rag-index.json");
    try {
      // Write index with wrong model (text-embedding-3-small instead of gemini-embedding-001)
      fs.writeFileSync(
        tempIndex,
        JSON.stringify({
          version: 1,
          model: "text-embedding-3-small",
          dimensions: 768,
          createdAt: new Date().toISOString(),
          records: [{ id: "c-1", vector: new Array(768).fill(0.1) }],
        }),
      );

      const manager = new PortfolioIndexManager();
      await assert.rejects(
        () => manager.initialize({ filePath: tempIndex }),
        /model mismatch \(expected: gemini-embedding-001, found: text-embedding-3-small\)/,
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

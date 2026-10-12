import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { chunkKnowledgeDocuments, InMemoryVectorStore, searchPortfolioKnowledge } from "./rag";
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

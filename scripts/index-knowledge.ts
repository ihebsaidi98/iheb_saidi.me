/**
 * scripts/index-knowledge.ts
 *
 * Precomputes and serializes document embeddings for the portfolio knowledge base.
 * Run this command whenever portfolio data changes or before deploying:
 *
 *   npm run index:kb
 *   or: npx tsx scripts/index-knowledge.ts
 */

import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { portfolioPublicDocuments } from "../src/lib/knowledge-base";
import {
  chunkKnowledgeDocuments,
  validateEmbeddingVector,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_DIMENSIONS,
  type SerializedVectorIndex,
  type StoredRecord,
} from "../src/lib/rag";

// Read from .env.local if not already in process.env
function loadEnvLocal(): void {
  const envLocalPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envLocalPath)) {
    const lines = fs.readFileSync(envLocalPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvLocal();

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
const dimensions = DEFAULT_EMBEDDING_DIMENSIONS;

if (!apiKey) {
  console.error("Error: GEMINI_API_KEY environment variable is missing.");
  console.error("Please add GEMINI_API_KEY to your .env.local file.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function embedWithRetry(
  text: string,
  title: string,
  retries = 3,
): Promise<number[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await ai.models.embedContent({
        model,
        contents: text,
        config: {
          taskType: "RETRIEVAL_DOCUMENT",
          title,
          outputDimensionality: dimensions,
        },
      });
      const vec = res.embeddings?.[0]?.values;
      if (!vec || !Array.isArray(vec)) {
        throw new Error("Missing embedding vector in Gemini response");
      }
      return validateEmbeddingVector(vec, dimensions);
    } catch (err) {
      if (attempt === retries) throw err;
      const delayMs = attempt * 1500;
      console.warn(`  [Retry ${attempt}/${retries}] Waiting ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Failed to embed after retries");
}

async function main() {
  console.log("====================================================");
  console.log("Portfolio Knowledge Base Embedding Indexer");
  console.log("====================================================");
  console.log(`Model:      ${model}`);
  console.log(`Dimensions: ${dimensions}`);
  console.log(`Documents:  ${portfolioPublicDocuments.length} public documents`);

  const chunks = chunkKnowledgeDocuments(portfolioPublicDocuments);
  console.log(`Chunks:     ${chunks.length} chunks generated\n`);

  const records: StoredRecord[] = new Array(chunks.length);
  const startTime = Date.now();

  // Process chunks in small concurrency batches of 4, keeping output deterministically indexed
  const CONCURRENCY = 4;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (chunk, batchIdx) => {
        const globalIdx = i + batchIdx;
        process.stdout.write(
          `[${globalIdx + 1}/${chunks.length}] Embedding chunk: ${chunk.id} (${chunk.title.slice(0, 30)}...)\n`,
        );
        const vector = await embedWithRetry(chunk.text, chunk.title);
        records[globalIdx] = {
          ...chunk,
          vector,
        };
      }),
    );
  }

  // Ensure output directory exists
  const outputPath = path.join(process.cwd(), "src", "data", "rag-index.json");
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const payload: SerializedVectorIndex = {
    version: 1,
    kbVersion: "2026.1",
    model,
    dimensions,
    createdAt: new Date().toISOString(),
    recordsCount: records.length,
    records,
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const fileSizeKb = (fs.statSync(outputPath).size / 1024).toFixed(1);

  console.log("\n====================================================");
  console.log(`Index successfully built in ${elapsed}s!`);
  console.log(`Output: ${outputPath} (${fileSizeKb} KB)`);
  console.log(`Total records: ${records.length}`);
  console.log("====================================================");
}

main().catch((err) => {
  console.error("\nIndexing failed:", err);
  process.exit(1);
});

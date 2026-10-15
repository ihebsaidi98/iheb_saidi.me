# Iheb Saidi Portfolio

This repository contains the current Next.js portfolio for Iheb Saidi, a full-stack software engineer focused on Java, Spring Boot, Angular, and production-grade backend/frontend systems.

## Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Framer Motion
- Three.js for the hero 3D scene
- custom client-side enhancements for motion and smooth scrolling

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Project structure

- src/app — app shell, global styles, metadata, and route files
- src/components — reusable UI and visual enhancements
- src/sections — portfolio sections
- src/data — profile, experience, education, and project data
- public/images — project screenshots used by the portfolio

## AI Chatbot & RAG Knowledge Base

The portfolio includes an AI chatbot grounded on Iheb Saidi's verified background using Google Gemini (`@google/genai`) and a precomputed vector index (`src/data/rag-index.json`).

### Precomputing the Knowledge Base Index

The document embeddings are precomputed into `src/data/rag-index.json` using `gemini-embedding-001` (768 dimensions), so the server never needs to re-embed knowledge chunks on incoming user messages.

**When to rerun `npm run index:kb`:**
- Whenever files in `src/data/` (`profile.ts`, `experience.ts`, `projects.ts`, `about.ts`, `education.ts`, `site.ts`) are edited.
- Whenever documents in `src/lib/knowledge-base.ts` are added, modified, or rephrased.
- Whenever the embedding model or target dimensionality configuration is changed.

```bash
npm run index:kb
```

## Notes

- The active project system is the current professional experience and academic project implementations in the app.
- Legacy duplicated project-card and UI code has been removed in favor of the active implementation.
- Metadata and sitemap are configured for the live domain: https://iheb-saidi.dev

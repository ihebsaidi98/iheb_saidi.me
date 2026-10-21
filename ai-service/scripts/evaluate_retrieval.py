"""Evaluation script for RAG retrieval pipeline measuring Recall@k, MRR, and Abstention Rate.

Can run 100% offline using deterministic test vectors, or live against Google Gemini.
Supports:
    - Baseline sanity benchmark: exact target vectors (evaluates indexing & dot product math)
    - Realistic perturbed benchmark: simulated query-document semantic shifts & negative queries
    - Live embedding benchmark: queries embedded on-the-fly via Google GenAI

Usage:
    uv run python scripts/evaluate_retrieval.py [--dataset path] [--mode offline|live] [--threshold 0.35]
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path

import numpy as np

# Ensure app package is importable
repo_ai_root = Path(__file__).resolve().parents[1]
if str(repo_ai_root) not in sys.path:
    sys.path.insert(0, str(repo_ai_root))

from app.config import get_settings  # noqa: E402
from app.core.gemini_client import get_gemini_client  # noqa: E402
from app.rag.embedder import embed_query  # noqa: E402
from app.rag.retriever import retrieve_relevant_chunks  # noqa: E402
from app.rag.store import PortfolioVectorStore  # noqa: E402

logging.basicConfig(level=logging.WARNING)


def run_evaluation(
    dataset_path: Path,
    index_path: Path | None,
    mode: str = "offline",
    k_values: tuple[int, ...] = (1, 3, 5),
    threshold: float = 0.35,
) -> dict:
    """Execute retrieval benchmark and calculate Recall@k, MRR, and negative abstention metrics."""
    with open(dataset_path, encoding="utf-8") as f:
        dataset = json.load(f)

    queries = dataset.get("queries", [])
    if not queries:
        raise ValueError(f"No queries found in {dataset_path}")

    store = PortfolioVectorStore.from_file(file_path=index_path)
    settings = get_settings()

    # Verify that all expected document IDs exist in the loaded knowledge index
    known_doc_ids = {r.document_id for r in store.records}
    missing_sources: dict[str, list[str]] = {}
    for item in queries:
        for doc_id in item.get("expected_document_ids", []):
            if doc_id not in known_doc_ids:
                missing_sources.setdefault(doc_id, []).append(item.get("id", "unknown"))

    gemini_client = None
    if mode == "live":
        gemini_client = get_gemini_client(settings)
        if not gemini_client:
            raise RuntimeError("GEMINI_API_KEY is required for live mode evaluation.")

    max_k = max(k_values)
    hits_at_k: dict[int, int] = dict.fromkeys(k_values, 0)
    reciprocal_ranks: list[float] = []
    retrieval_latencies_ms: list[float] = []
    embedding_latencies_ms: list[float] = []
    per_query_results = []

    pos_count = 0
    neg_count = 0
    neg_correct_abstentions = 0

    for item in queries:
        qid = item["id"]
        qtext = item["query"]
        expected_doc_ids = set(item.get("expected_document_ids", []))
        is_negative = len(expected_doc_ids) == 0

        # 1. Obtain query vector (measure embedding latency separately in live mode)
        if mode == "live":
            t_emb_start = time.perf_counter()
            query_vector = embed_query(qtext, gemini_client, settings)
            embedding_latencies_ms.append((time.perf_counter() - t_emb_start) * 1000.0)
        else:
            raw_vec = item.get("offline_vector")
            if not raw_vec:
                raise ValueError(
                    f"Query {qid} missing 'offline_vector' for offline evaluation."
                )
            vec = np.asarray(raw_vec, dtype=np.float32)
            norm = float(np.linalg.norm(vec))
            query_vector = vec / norm if norm > 1e-6 else vec

        # 2. Measure STRICT retrieval latency (only vector comparison & sorting)
        t_ret_start = time.perf_counter()
        results = retrieve_relevant_chunks(
            query_vector,
            store,
            limit=max_k,
            threshold=threshold,
        )
        elapsed_ret_ms = (time.perf_counter() - t_ret_start) * 1000.0
        retrieval_latencies_ms.append(elapsed_ret_ms)

        retrieved_doc_ids = [r.document_id for r in results]

        # 3. Handle scoring based on positive vs negative query type
        if is_negative:
            neg_count += 1
            # Correct abstention: nothing returned above threshold
            correct_abstention = len(results) == 0
            if correct_abstention:
                neg_correct_abstentions += 1
            rr = 0.0
        else:
            pos_count += 1
            # Evaluate Hit@k for positive queries
            for k in k_values:
                top_k_docs = set(retrieved_doc_ids[:k])
                if top_k_docs & expected_doc_ids:
                    hits_at_k[k] += 1

            # Evaluate Reciprocal Rank
            rr = 0.0
            for rank, doc_id in enumerate(retrieved_doc_ids, start=1):
                if doc_id in expected_doc_ids:
                    rr = 1.0 / rank
                    break
            reciprocal_ranks.append(rr)

        per_query_results.append(
            {
                "id": qid,
                "query": qtext,
                "is_negative": is_negative,
                "expected": list(expected_doc_ids),
                "retrieved": retrieved_doc_ids,
                "top_score": results[0].score if results else 0.0,
                "rr": rr if not is_negative else None,
                "retrieval_latency_ms": round(elapsed_ret_ms, 2),
            }
        )

    # Calculate metrics
    recall_at_k = (
        {k: hits_at_k[k] / pos_count for k in k_values}
        if pos_count > 0
        else dict.fromkeys(k_values, 0.0)
    )
    mrr = sum(reciprocal_ranks) / pos_count if pos_count > 0 else 0.0
    abstention_rate = neg_correct_abstentions / neg_count if neg_count > 0 else None

    avg_ret_latency = sum(retrieval_latencies_ms) / len(queries)
    p95_ret_latency = float(np.percentile(retrieval_latencies_ms, 95))

    avg_emb_latency = (
        sum(embedding_latencies_ms) / len(embedding_latencies_ms)
        if embedding_latencies_ms
        else None
    )

    return {
        "dataset_name": Path(dataset_path).name,
        "dataset_description": dataset.get("description", ""),
        "mode": mode,
        "index_metadata": {
            "model": store.model,
            "dimensions": store.dimensions,
            "version": store.version,
            "kb_version": store.kb_version,
            "total_records": store.count,
            "unique_document_ids": len(known_doc_ids),
        },
        "missing_expected_sources": missing_sources,
        "query_counts": {
            "total": len(queries),
            "positive": pos_count,
            "negative": neg_count,
        },
        "threshold": threshold,
        "recall_at_k": recall_at_k,
        "mrr": round(mrr, 4),
        "abstention_rate": (
            round(abstention_rate, 4) if abstention_rate is not None else "N/A"
        ),
        "avg_retrieval_latency_ms": round(avg_ret_latency, 2),
        "p95_retrieval_latency_ms": round(p95_ret_latency, 2),
        "avg_embedding_latency_ms": (
            round(avg_emb_latency, 2) if avg_emb_latency is not None else None
        ),
        "results": per_query_results,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate RAG retrieval quality.")
    parser.add_argument(
        "--dataset",
        type=Path,
        default=repo_ai_root / "data" / "evaluation_queries.json",
        help="Path to evaluation queries JSON (defaults to evaluation_queries.json)",
    )
    parser.add_argument(
        "--index",
        type=Path,
        default=None,
        help="Explicit path to rag-index.json",
    )
    parser.add_argument(
        "--mode",
        choices=["offline", "live"],
        default="offline",
        help="offline (deterministic, no API calls) or live (calls Gemini API)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.35,
        help="Similarity score threshold (default: 0.35)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output raw JSON metrics",
    )

    args = parser.parse_args()

    metrics = run_evaluation(
        dataset_path=args.dataset,
        index_path=args.index,
        mode=args.mode,
        k_values=(1, 3, 5),
        threshold=args.threshold,
    )

    if args.json:
        print(json.dumps(metrics, indent=2))
        return

    idx_meta = metrics["index_metadata"]
    counts = metrics["query_counts"]

    print("\n=======================================================")
    print(f"RAG RETRIEVAL PIPELINE EVALUATION (Mode: {metrics['mode'].upper()})")
    print("=======================================================")
    print(f"Dataset File:            {metrics['dataset_name']}")
    print(
        f"Total Queries:           {counts['total']} ({counts['positive']} positive, {counts['negative']} negative)"
    )
    print(
        f"Knowledge Base:          {idx_meta['total_records']} chunks across {idx_meta['unique_document_ids']} documents"
    )
    print(
        f"Index Model & Dims:      {idx_meta['model']} ({idx_meta['dimensions']} dimensions)"
    )
    print(f"KB Version:              {idx_meta['kb_version']}")
    print(f"Similarity Threshold:    {metrics['threshold']}")
    if metrics["missing_expected_sources"]:
        print(f"WARNING: Missing Sources: {metrics['missing_expected_sources']}")
    else:
        print("Expected Sources Check:  All expected sources verified in index")
    print("-------------------------------------------------------")
    print(f"Recall@1 (Hit Rate@1):  {metrics['recall_at_k'][1] * 100:.1f}%")
    print(f"Recall@3 (Hit Rate@3):  {metrics['recall_at_k'][3] * 100:.1f}%")
    print(f"Recall@5 (Hit Rate@5):  {metrics['recall_at_k'][5] * 100:.1f}%")
    print(f"Mean Reciprocal Rank:    {metrics['mrr']:.4f}")
    if metrics["abstention_rate"] != "N/A":
        print(f"Negative Abstention Rate: {metrics['abstention_rate'] * 100:.1f}%")
    print(
        f"Avg Retrieval Latency:   {metrics['avg_retrieval_latency_ms']:.2f} ms (P95: {metrics['p95_retrieval_latency_ms']:.2f} ms)"
    )
    if metrics["avg_embedding_latency_ms"] is not None:
        print(f"Avg Embedding Latency:   {metrics['avg_embedding_latency_ms']:.2f} ms")
    print("=======================================================\n")

    # Gate: Fail if MRR < 0.70 or Recall@5 < 0.85
    if metrics["recall_at_k"][5] < 0.85 or metrics["mrr"] < 0.70:
        print("FAILED: Quality thresholds not met (Recall@5 >= 0.85, MRR >= 0.70)")
        sys.exit(1)
    else:
        print("PASSED: Quality thresholds successfully met.")


if __name__ == "__main__":
    main()

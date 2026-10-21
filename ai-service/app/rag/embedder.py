"""Query embedding using Google GenAI SDK with dimension validation."""

import logging
from typing import Any

import numpy as np
from google.genai import types

from app.config import Settings
from app.core.safe_errors import redact_secrets

logger = logging.getLogger("ai_service.rag.embedder")


class EmbedderError(Exception):
    """Raised when query embedding generation fails."""


def embed_query(
    query: str,
    client: Any,
    settings: Settings,
) -> np.ndarray:
    """Generate normalized query embedding vector using Google GenAI SDK.

    Uses task_type="RETRIEVAL_QUERY" and enforces expected output dimensionality.
    Returns normalized 1D NumPy array for fast cosine dot product.
    """
    cleaned_query = query.strip()
    if not cleaned_query:
        raise EmbedderError("Query string cannot be empty.")

    if client is None:
        raise EmbedderError("Gemini client is not configured.")

    expected_dim = settings.gemini_embedding_dimensions
    model = settings.gemini_embedding_model

    try:
        response = client.models.embed_content(
            model=model,
            contents=cleaned_query,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_QUERY",
                output_dimensionality=expected_dim,
            ),
        )

        embeddings = getattr(response, "embeddings", None)
        if not embeddings or not isinstance(embeddings, list) or len(embeddings) == 0:
            raise EmbedderError(
                "Gemini returned an empty or missing embedding response."
            )

        raw_values = getattr(embeddings[0], "values", None)
        if (
            raw_values is None
            or not isinstance(raw_values, list)
            or len(raw_values) == 0
        ):
            raise EmbedderError("Gemini returned an empty embedding values array.")

        if len(raw_values) != expected_dim:
            raise EmbedderError(
                f"Embedding dimension mismatch: expected {expected_dim}, got {len(raw_values)}."
            )

        vec = np.asarray(raw_values, dtype=np.float32)

        if not np.all(np.isfinite(vec)):
            raise EmbedderError(
                "Gemini returned non-finite (NaN or Inf) values in embedding vector."
            )

        norm = float(np.linalg.norm(vec))
        if norm < 1e-6:
            raise EmbedderError(f"Embedding vector has near-zero magnitude ({norm}).")

        # Return normalized unit vector
        return vec / norm

    except EmbedderError:
        raise
    except Exception as err:
        logger.error(
            "Failed to generate query embedding [%s]: %s",
            type(err).__name__,
            redact_secrets(str(err)),
        )
        raise EmbedderError("Query embedding generation failed.") from err

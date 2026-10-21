"""In-memory vector store loaded from precomputed rag-index.json using NumPy."""

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger("ai_service.rag.store")


class VectorIndexError(Exception):
    """Base exception for vector index failures."""


class VectorIndexNotFoundError(VectorIndexError):
    """Raised when the precomputed rag-index.json file cannot be located."""


class VectorIndexCorruptError(VectorIndexError):
    """Raised when index metadata or embedding vectors fail schema or numerical validation."""


@dataclass(frozen=True)
class VectorRecord:
    """Immutable representation of a single chunk stored in the vector store."""

    id: str
    document_id: str
    source: str
    type: str
    title: str
    summary: str
    text: str
    tags: tuple[str, ...] = field(default_factory=tuple)
    metadata: dict[str, Any] = field(default_factory=dict)


class PortfolioVectorStore:
    """NumPy-powered in-memory vector store for portfolio knowledge chunks."""

    def __init__(
        self,
        records: tuple[VectorRecord, ...],
        normalized_matrix: np.ndarray,
        model: str,
        dimensions: int,
        version: int,
        kb_version: str,
        created_at: str,
    ) -> None:
        # Enforce immutability on the underlying NumPy matrix
        normalized_matrix.flags.writeable = False
        self.records = records
        self.normalized_matrix = normalized_matrix
        self.model = model
        self.dimensions = dimensions
        self.version = version
        self.kb_version = kb_version
        self.created_at = created_at

    @property
    def count(self) -> int:
        return len(self.records)

    @classmethod
    def resolve_index_path(cls, explicit_path: Path | str | None = None) -> Path:
        """Resolve the path to the rag-index.json file across dev, test, and container environments."""
        if explicit_path:
            p = Path(explicit_path).resolve()
            if p.is_file():
                return p
            raise VectorIndexNotFoundError(
                f"Explicit knowledge index file does not exist: {p}"
            )

        candidates: list[Path] = []
        # Relative to this file (ai-service/app/rag/store.py -> repo_root/src/data/rag-index.json)
        repo_root = Path(__file__).resolve().parents[3]
        candidates.append(repo_root / "src" / "data" / "rag-index.json")

        # Relative to current working directory
        candidates.append(Path.cwd() / "src" / "data" / "rag-index.json")
        candidates.append(Path.cwd() / "rag-index.json")

        for path in candidates:
            if path.is_file():
                return path

        raise VectorIndexNotFoundError(
            f"Precomputed knowledge index could not be found. Checked: {[str(p) for p in candidates]}"
        )

    @classmethod
    def from_file(
        cls,
        file_path: Path | str | None = None,
        expected_model: str = "gemini-embedding-001",
        expected_dimensions: int = 768,
    ) -> "PortfolioVectorStore":
        """Load and validate precomputed vector index from disk."""
        resolved_path = cls.resolve_index_path(file_path)
        logger.info("Loading vector index file %s", resolved_path.name)

        try:
            with open(resolved_path, encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as err:
            raise VectorIndexCorruptError(
                f"Malformed JSON in vector index at {resolved_path}: {err}"
            ) from err
        except OSError as err:
            raise VectorIndexNotFoundError(
                f"Failed to read vector index at {resolved_path}: {err}"
            ) from err

        if not isinstance(data, dict):
            raise VectorIndexCorruptError(
                f"Invalid index format: expected root JSON object, got {type(data).__name__}"
            )

        model = data.get("model")
        dimensions = data.get("dimensions")
        version = data.get("version")
        kb_version = str(data.get("kbVersion", "unknown"))
        created_at = str(data.get("createdAt", ""))
        records_raw = data.get("records")
        records_count = data.get("recordsCount")

        # Validate header metadata
        if model != expected_model:
            raise VectorIndexCorruptError(
                f"Index model mismatch: expected '{expected_model}', found '{model}'."
            )

        if dimensions != expected_dimensions:
            raise VectorIndexCorruptError(
                f"Index dimension mismatch: expected {expected_dimensions}, found {dimensions}."
            )

        if not isinstance(records_raw, list) or len(records_raw) == 0:
            raise VectorIndexCorruptError(
                "Index contains no records or 'records' is not a list."
            )

        if records_count is not None and len(records_raw) != records_count:
            raise VectorIndexCorruptError(
                f"Index records count mismatch: header declares {records_count}, but found {len(records_raw)}."
            )

        records_list: list[VectorRecord] = []
        vectors_list: list[np.ndarray] = []

        for idx, item in enumerate(records_raw):
            if not isinstance(item, dict):
                raise VectorIndexCorruptError(
                    f"Record at index {idx} is not an object."
                )

            record_id = str(item.get("id", f"record-{idx}"))
            document_id = str(item.get("documentId", record_id))
            source = str(item.get("source", ""))
            doc_type = str(item.get("type", "unknown"))
            title = str(item.get("title", ""))
            summary = str(item.get("summary", ""))
            text = str(item.get("text", ""))
            raw_tags = item.get("tags") or []
            tags = tuple(str(t) for t in raw_tags if isinstance(t, str))
            metadata = item.get("metadata") or {}
            if not isinstance(metadata, dict):
                metadata = {}

            raw_vector = item.get("vector")
            if (
                not isinstance(raw_vector, list)
                or len(raw_vector) != expected_dimensions
            ):
                raise VectorIndexCorruptError(
                    f"Record '{record_id}' vector length is {len(raw_vector) if isinstance(raw_vector, list) else 'invalid'}; expected {expected_dimensions}."
                )

            vec = np.asarray(raw_vector, dtype=np.float32)

            if not np.all(np.isfinite(vec)):
                raise VectorIndexCorruptError(
                    f"Record '{record_id}' vector contains non-finite (NaN or Inf) values."
                )

            norm = float(np.linalg.norm(vec))
            if norm < 1e-6:
                raise VectorIndexCorruptError(
                    f"Record '{record_id}' vector has near-zero magnitude ({norm})."
                )

            # Store normalized vector for unit dot products
            normalized_vec = vec / norm

            records_list.append(
                VectorRecord(
                    id=record_id,
                    document_id=document_id,
                    source=source,
                    type=doc_type,
                    title=title,
                    summary=summary,
                    text=text,
                    tags=tags,
                    metadata=metadata,
                )
            )
            vectors_list.append(normalized_vec)

        normalized_matrix = np.stack(vectors_list, axis=0)

        logger.info(
            "Successfully loaded %d records from vector index (model=%s, dim=%d)",
            len(records_list),
            model,
            dimensions,
        )

        return cls(
            records=tuple(records_list),
            normalized_matrix=normalized_matrix,
            model=str(model),
            dimensions=int(dimensions),
            version=int(version) if isinstance(version, int) else 1,
            kb_version=kb_version,
            created_at=created_at,
        )

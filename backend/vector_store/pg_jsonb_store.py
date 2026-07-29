"""PostgreSQL + JSONB vector store implementation.

Stores embedding vectors as JSONB arrays in four dedicated tables.
Vector similarity (cosine) is computed in Python via numpy since the
pgvector extension is not available on the target PG 16.14 server.

Schema per table:
    id            SERIAL PRIMARY KEY
    content       TEXT NOT NULL
    embedding     JSONB NOT NULL       -- [0.0012, -0.034, ...]  (384 floats)
    metadata      JSONB DEFAULT '{}'
    created_at    TIMESTAMPTZ DEFAULT now()
    updated_at    TIMESTAMPTZ DEFAULT now()

Tables (one per collection):
    code_embeddings, document_embeddings, schema_embeddings, prompt_embeddings
"""
import json
import logging
import numpy as np
from typing import Any

from apps.Treasury.backend.database import get_repo
from .interface import VectorStore, SearchResult

logger = logging.getLogger(__name__)

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS {table} (
    id          SERIAL PRIMARY KEY,
    content     TEXT NOT NULL,
    embedding   JSONB NOT NULL,
    metadata    JSONB DEFAULT '{{}}'::jsonb,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_{table}_gin_meta ON {table} USING GIN (metadata);
"""


class PgJsonbVectorStore(VectorStore):
    """Vector store backed by PostgreSQL JSONB + numpy cosine similarity."""

    def __init__(self):
        self._initialized = False

    # ── Lifecycle ──────────────────────────────────────────────────────────

    def initialize(self):
        if self._initialized:
            return
        repo = get_repo()
        for col in self.COLLECTIONS:
            repo.execute(CREATE_TABLE_SQL.format(table=col))
        self._initialized = True
        logger.info("PgJsonbVectorStore: 4 JSONB tables ready (%s)",
                     ", ".join(self.COLLECTIONS))

    # ── Write helpers ──────────────────────────────────────────────────────

    def _embedding_to_json(self, embedding: list[float]) -> str:
        return json.dumps([float(v) for v in embedding])

    def upsert(self, collection: str, embedding: list[float],
               content: str, metadata: dict | None = None) -> str:
        self._ensure_collection(collection)
        repo = get_repo()
        meta_json = json.dumps(metadata or {})
        emb_json = self._embedding_to_json(embedding)
        # PostgreSQL TEXT cannot store NUL (0x00) bytes
        content = content.replace("\x00", "")
        rows = repo.fetch_all(
            f"INSERT INTO {collection} (content, embedding, metadata) "
            f"VALUES (%s, %s::jsonb, %s::jsonb) RETURNING id",
            (content, emb_json, meta_json)
        )
        return str(rows[0]["id"])

    def batch_upsert(self, collection: str,
                     embeddings: list[list[float]],
                     contents: list[str],
                     metadatas: list[dict | None] | None = None) -> list[str]:
        self._ensure_collection(collection)
        repo = get_repo()
        ids: list[str] = []
        # Single-row inserts (PostgreSQL JSONB + list params are tricky for
        # multi-row INSERT; for moderate batches this is fine)
        for i, emb in enumerate(embeddings):
            meta = (metadatas or [{}] * len(embeddings))[i] or {}
            mid = self.upsert(collection, emb, contents[i], meta)
            ids.append(mid)
        return ids

    def delete(self, collection: str, id: str) -> bool:
        self._ensure_collection(collection)
        repo = get_repo()
        repo.execute(f"DELETE FROM {collection} WHERE id = %s", (int(id),))
        return repo.fetch_one(f"SELECT id FROM {collection} WHERE id = %s",
                              (int(id),)) is None

    # ── Read ───────────────────────────────────────────────────────────────

    def search(self, collection: str, query_vector: list[float],
               top_k: int = 10) -> list[SearchResult]:
        self._ensure_collection(collection)
        repo = get_repo()
        rows = repo.fetch_all(
            f"SELECT id, content, embedding, metadata FROM {collection}"
        )
        if not rows:
            return []

        # Cosine similarity in numpy
        query_arr = np.array(query_vector, dtype=np.float32)
        query_norm = np.linalg.norm(query_arr)
        if query_norm == 0:
            return []
        query_unit = query_arr / query_norm

        scored: list[tuple[float, dict[str, Any]]] = []
        for row in rows:
            vec = np.array(row["embedding"], dtype=np.float32)
            vec_norm = np.linalg.norm(vec)
            if vec_norm == 0:
                continue
            sim = float(np.dot(query_unit, vec / vec_norm))
            scored.append((sim, row))

        scored.sort(key=lambda x: x[0], reverse=True)
        results = []
        for sim, row in scored[:top_k]:
            results.append(SearchResult(
                id=str(row["id"]),
                content=row["content"],
                metadata=row["metadata"] or {},
                score=round(float(sim), 4),
                source_table=collection,
            ))
        return results

    def search_hybrid(self, collection: str, query_vector: list[float],
                      query_text: str, top_k: int = 10) -> list[SearchResult]:
        """Vector search + text overlap boost (simple TF-like)."""
        base = self.search(collection, query_vector, top_k * 2)
        if not base:
            return base

        # Boost scores where content contains query terms
        terms = set(query_text.lower().split())
        for r in base:
            content_lower = r.content.lower()
            match_count = sum(1 for t in terms if t in content_lower)
            r.score += 0.05 * match_count  # small boost per matched term

        base.sort(key=lambda x: x.score, reverse=True)
        return base[:top_k]

    def count(self, collection: str) -> int:
        self._ensure_collection(collection)
        repo = get_repo()
        row = repo.fetch_one(f"SELECT COUNT(*) AS cnt FROM {collection}")
        return row["cnt"] if row else 0

    def clear(self, collection: str) -> int:
        self._ensure_collection(collection)
        repo = get_repo()
        before = self.count(collection)
        repo.execute(f"TRUNCATE {collection}")
        return before

    # ── Internal ───────────────────────────────────────────────────────────

    def _ensure_collection(self, collection: str):
        if collection not in self.COLLECTIONS:
            raise ValueError(
                f"Unknown collection '{collection}'. "
                f"Valid: {', '.join(self.COLLECTIONS)}"
            )
        if not self._initialized:
            self.initialize()

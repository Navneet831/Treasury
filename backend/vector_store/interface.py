"""Abstract interface for vector stores.

All vector operations go through this abstraction so the backend can
swap between pgvector (native), JSONB+numpy, FAISS, or any other store
without touching business logic.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SearchResult:
    """A single match from a vector similarity search."""
    id: str | int
    content: str
    metadata: dict = field(default_factory=dict)
    score: float = 0.0
    source_table: str = ""


class VectorStore(ABC):
    """Abstract vector store.

    Four mandatory collections match the four embedding types:
        - code_embeddings     (source code chunks)
        - document_embeddings (docs / markdown)
        - schema_embeddings   (DB schema descriptions)
        - prompt_embeddings   (historical Q&A pairs)
    """

    COLLECTIONS = ("code_embeddings", "document_embeddings",
                   "schema_embeddings", "prompt_embeddings")

    # ── Lifecycle ──────────────────────────────────────────────────────────

    @abstractmethod
    def initialize(self):
        """Ensure the underlying storage is ready (create tables, etc.)."""
        ...

    # ── Write ──────────────────────────────────────────────────────────────

    @abstractmethod
    def upsert(self, collection: str, embedding: list[float],
               content: str, metadata: dict | None = None) -> str:
        """Insert or replace a vector + content. Returns the row id."""
        ...

    @abstractmethod
    def batch_upsert(self, collection: str,
                     embeddings: list[list[float]],
                     contents: list[str],
                     metadatas: list[dict | None] | None = None) -> list[str]:
        """Insert many vectors in one round-trip. Returns row ids."""
        ...

    @abstractmethod
    def delete(self, collection: str, id: str) -> bool:
        """Remove a vector by id. Returns True if deleted."""
        ...

    # ── Read ───────────────────────────────────────────────────────────────

    @abstractmethod
    def search(self, collection: str, query_vector: list[float],
               top_k: int = 10) -> list[SearchResult]:
        """Return the top_k most similar vectors to query_vector."""
        ...

    @abstractmethod
    def search_hybrid(self, collection: str, query_vector: list[float],
                      query_text: str, top_k: int = 10) -> list[SearchResult]:
        """Optional: combine vector similarity + keyword match."""
        ...

    @abstractmethod
    def count(self, collection: str) -> int:
        """Return number of vectors in the collection."""
        ...

    @abstractmethod
    def clear(self, collection: str) -> int:
        """Remove all vectors from the collection. Returns count removed."""
        ...

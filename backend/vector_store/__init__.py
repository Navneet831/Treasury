"""Vector store abstraction and PostgreSQL/JSONB implementation.

Provides a swappable interface for vector similarity search.
Default implementation uses PostgreSQL + JSONB arrays + numpy cosine similarity
(since pgvector extension is not available on the remote PG 16.14 server).
If pgvector is ever installed, swap in `PgVectorStore` via factory.
"""
from .interface import VectorStore, SearchResult
from .pg_jsonb_store import PgJsonbVectorStore

__all__ = ["VectorStore", "SearchResult", "PgJsonbVectorStore"]

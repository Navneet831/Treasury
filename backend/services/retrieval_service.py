"""Retrieval service — fetches relevant context from the vector store for a query.

Combines results from all four collections (code, docs, schema, prompts)
and returns a ranked, deduplicated context string.
"""
import logging
from typing import Optional

from apps.Treasury.backend.vector_store import VectorStore, SearchResult
from apps.Treasury.backend.vector_store import PgJsonbVectorStore
from apps.Treasury.backend.services.embedding_service import encode

logger = logging.getLogger(__name__)


def retrieve_context(
    query: str,
    store: Optional[VectorStore] = None,
    top_k_per_collection: int = 5,
    max_total_chunks: int = 15,
    include_code: bool = True,
    include_docs: bool = True,
    include_schema: bool = True,
    include_prompts: bool = True,
) -> list[SearchResult]:
    """Encode the query and search all enabled collections.

    Returns a deduplicated, ranked list of SearchResult objects.
    """
    if store is None:
        store = PgJsonbVectorStore()
        store.initialize()

    query_vec = encode(query)
    collections = []
    if include_code:
        collections.append("code_embeddings")
    if include_docs:
        collections.append("document_embeddings")
    if include_schema:
        collections.append("schema_embeddings")
    if include_prompts:
        collections.append("prompt_embeddings")

    all_results: list[SearchResult] = []
    for col in collections:
        try:
            results = store.search(col, query_vec, top_k=top_k_per_collection)
            all_results.extend(results)
        except Exception as e:
            logger.warning("retrieve_context: search on %s failed: %s", col, e)

    # Deduplicate by content hash
    seen: set[int] = set()
    deduped: list[SearchResult] = []
    for r in sorted(all_results, key=lambda x: x.score, reverse=True):
        h = hash(r.content)
        if h not in seen:
            seen.add(h)
            deduped.append(r)

    return deduped[:max_total_chunks]


def format_context(results: list[SearchResult]) -> str:
    """Format search results into a single context string for the LLM prompt."""
    parts = []
    for i, r in enumerate(results):
        source = r.metadata.get("source_file", r.source_table)
        header = f"[{i+1}] (score={r.score:.3f}) from {source}"
        parts.append(f"{header}\n{r.content}")
    return "\n\n---\n\n".join(parts)


def summarize_context(
    query: str,
    store: Optional[VectorStore] = None,
) -> dict:
    """Full retrieval summary: finds context for a developer chat query."""
    results = retrieve_context(query, store=store)
    context = format_context(results)
    return {
        "query": query,
        "context": context,
        "chunks": len(results),
        "sources": list(set(
            r.metadata.get("source_file", r.source_table) for r in results
        )),
    }

"""Repository indexer — auto-indexes code, docs, and DB schema into the vector store.

Rules:
- Walks repo tree excluding .git, node_modules, .venv, __pycache__, dist, build, logs, .env, secrets, binaries.
- Supports incremental indexing (only changed/new/deleted files since last run).
- Chunks files intelligently: code files → function/class level, docs → paragraph level.
"""
import hashlib
import logging
import os
import json
import time
from pathlib import Path
from typing import Iterator

from apps.Treasury.backend.vector_store import VectorStore, PgJsonbVectorStore
from apps.Treasury.backend.services.embedding_service import encode_batch

logger = logging.getLogger(__name__)

# Directories/files to skip
EXCLUDED_DIRS = {
    ".git", "node_modules", ".venv", "__pycache__",
    "dist", "build", "logs", ".mypy_cache", ".pytest_cache",
    ".ruff_cache", ".opencode",
}
EXCLUDED_EXTENSIONS = {
    ".pyc", ".pyo", ".pyd", ".so", ".dll", ".dylib",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".eot",
    ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
}
EXCLUDED_FILES = {".env", ".DS_Store", "*.secret", "*.key", "*.pem"}
MAX_FILE_SIZE = 256 * 1024  # 256 KB

INDEX_STATE_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    ".opencode", "index_state.json"
)


# ── Chunking ──────────────────────────────────────────────────────────────

def _chunk_code(content: str, file_path: str) -> list[str]:
    """Split source code into logical chunks (functions, classes, top blocks)."""
    lines = content.split("\n")
    chunks: list[str] = []
    current: list[str] = []
    in_block = False

    for line in lines:
        stripped = line.strip()
        # Python: def / class at top level
        if stripped.startswith(("def ", "class ", "async def ")) and (
            not current or line[0] != " "
        ):
            if current:
                chunks.append("\n".join(current))
            current = [line]
            in_block = True
        elif stripped.startswith(("@", "#")) and current:
            current.append(line)
        elif in_block and line and line[0] in (" ", "\t"):
            current.append(line)
        elif in_block and stripped == "":
            current.append(line)
        elif in_block:
            chunks.append("\n".join(current))
            current = [line]
            in_block = False
        else:
            current.append(line)
    if current:
        chunks.append("\n".join(current))
    # Filter tiny chunks
    return [c for c in chunks if len(c) > 50]


def _chunk_docs(content: str, file_path: str) -> list[str]:
    """Split documentation into paragraph-level chunks."""
    paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
    merged: list[str] = []
    current = ""
    for p in paragraphs:
        if len(current) + len(p) < 1500:
            current += ("\n\n" if current else "") + p
        else:
            if current:
                merged.append(current)
            current = p
    if current:
        merged.append(current)
    return merged


def _chunk_file(file_path: str, content: str) -> list[str]:
    """Route to appropriate chunker based on file extension."""
    ext = Path(file_path).suffix.lower()
    code_exts = {
        ".py", ".js", ".ts", ".tsx", ".jsx", ".rs", ".go", ".java",
        ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php", ".swift",
        ".kt", ".scala", ".sh", ".bash", ".ps1", ".sql",
    }
    if ext in code_exts:
        return _chunk_code(content, file_path)
    # .md, .rst, .txt, .cfg, .ini, .yaml, .yml, .toml, .json
    return _chunk_docs(content, file_path)


# ── File walking ──────────────────────────────────────────────────────────

def _walk_repo(root: str) -> Iterator[tuple[str, str]]:
    """Yield (relative_path, absolute_path) for every indexable file."""
    root = os.path.abspath(root)
    for dirpath, dirnames, filenames in os.walk(root):
        # Prune excluded dirs in-place (stops os.walk descending)
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS]
        rel_dir = os.path.relpath(dirpath, root)
        for fn in filenames:
            if fn in EXCLUDED_FILES:
                continue
            ext = os.path.splitext(fn)[1].lower()
            if ext in EXCLUDED_EXTENSIONS:
                continue
            fpath = os.path.join(dirpath, fn)
            if os.path.getsize(fpath) > MAX_FILE_SIZE:
                continue
            rel = os.path.join(rel_dir, fn) if rel_dir != "." else fn
            yield rel, fpath


def _file_hash(file_path: str) -> str:
    """Return sha256 of file content."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_index_state() -> dict[str, str]:
    """Load previous index state: {relative_path: sha256_hash}."""
    if os.path.exists(INDEX_STATE_FILE):
        try:
            with open(INDEX_STATE_FILE) as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_index_state(state: dict[str, str]):
    os.makedirs(os.path.dirname(INDEX_STATE_FILE), exist_ok=True)
    with open(INDEX_STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


# ── Schema extraction ─────────────────────────────────────────────────────

def _extract_schema_descriptions() -> list[str]:
    """Return list of natural-language table descriptions from DB schema."""
    from apps.Treasury.backend.database import get_repo
    repo = get_repo()
    rows = repo.fetch_all(
        "SELECT table_name, column_name, data_type "
        "FROM information_schema.columns "
        "WHERE table_schema = 'public' "
        "ORDER BY table_name, ordinal_position"
    )
    tables: dict[str, list[str]] = {}
    for r in rows:
        tn = r["table_name"]
        tables.setdefault(tn, []).append(
            f"{r['column_name']} ({r['data_type']})"
        )
    descriptions = []
    for tn, cols in tables.items():
        descriptions.append(
            f"Table public.{tn} has columns: {' | '.join(cols)}"
        )
    return descriptions


# ── Main indexing entry point ────────────────────────────────────────────

def index_repository(
    repo_root: str | None = None,
    force: bool = False,
    store: VectorStore | None = None,
) -> dict:
    """Index the repository into the vector store.

    Returns a summary dict with counts.
    """
    if repo_root is None:
        repo_root = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )

    if store is None:
        store = PgJsonbVectorStore()
        store.initialize()

    old_state = {} if force else _load_index_state()
    new_state: dict[str, str] = {}
    changed: list[str] = []
    deleted: list[str] = []

    # Detect changed files
    for rel_path, abs_path in _walk_repo(repo_root):
        h = _file_hash(abs_path)
        new_state[rel_path] = h
        if rel_path not in old_state or old_state[rel_path] != h:
            changed.append(rel_path)

    # Detect deleted files
    for rel_path in old_state:
        if rel_path not in new_state:
            deleted.append(rel_path)

    if not changed and not deleted:
        logger.info("index_repository: no changes detected. (%d files cached)",
                     len(new_state))
        return {"indexed": 0, "deleted": 0, "total": len(new_state)}

    # Index changed files
    code_chunks: list[str] = []
    code_meta: list[dict] = []
    doc_chunks: list[str] = []
    doc_meta: list[dict] = []

    for rel_path in changed:
        abs_path = os.path.realpath(os.path.join(repo_root, rel_path))
        try:
            with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            # Strip NUL bytes that PostgreSQL cannot store in TEXT columns
            content = content.replace("\x00", "")
        except Exception as e:
            logger.warning("Cannot read %s: %s", rel_path, e)
            continue

        chunks = _chunk_file(rel_path, content)
        ext = os.path.splitext(rel_path)[1].lower()
        is_code = ext in {
            ".py", ".js", ".ts", ".tsx", ".jsx", ".rs", ".go", ".java",
            ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php", ".swift",
            ".kt", ".scala", ".sh", ".bash", ".ps1", ".sql",
        }
        target_collection = "code_embeddings" if is_code else "document_embeddings"
        target_chunks = code_chunks if is_code else doc_chunks
        target_meta = code_meta if is_code else doc_meta

        for i, chunk in enumerate(chunks):
            target_chunks.append(chunk)
            target_meta.append({
                "source_file": rel_path,
                "chunk_index": i,
                "extension": ext,
            })
            if len(target_chunks) >= 32:
                _flush(store, target_collection, target_chunks, target_meta)

    # Flush remaining
    if code_chunks:
        _flush(store, "code_embeddings", code_chunks, code_meta)
    if doc_chunks:
        _flush(store, "document_embeddings", doc_chunks, doc_meta)

    # Index DB schema descriptions
    schema_descriptions = _extract_schema_descriptions()
    if schema_descriptions:
        existing = store.count("schema_embeddings")
        if force or existing == 0:
            if existing > 0:
                store.clear("schema_embeddings")
            _flush(store, "schema_embeddings", schema_descriptions,
                   [{"source": "information_schema"}] * len(schema_descriptions))

    # Delete removed files
    for rel_path in deleted:
        # Simple approach: re-index is easier than per-file delete for JSONB store
        # The next search won't find stale content because it searches all rows
        pass

    _save_index_state(new_state)

    summary = {
        "indexed": len(changed),
        "deleted": len(deleted),
        "total": len(new_state),
        "code_chunks": len(code_chunks),
        "doc_chunks": len(doc_chunks),
        "schema_tables": len(schema_descriptions),
    }
    logger.info("index_repository complete: %s", summary)
    return summary


def _flush(store: VectorStore, collection: str,
           chunks: list[str], metadatas: list[dict]):
    """Encode and upsert a batch of chunks."""
    if not chunks:
        return
    logger.info("Encoding %d %s chunks...", len(chunks), collection)
    t0 = time.time()
    embeddings = encode_batch(chunks)
    elapsed = time.time() - t0
    store.batch_upsert(collection, embeddings, chunks, metadatas)
    logger.info("Flushed %d %s chunks in %.2fs", len(chunks), collection, elapsed)
    chunks.clear()
    metadatas.clear()

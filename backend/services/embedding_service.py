"""Embedding service using sentence-transformers (all-MiniLM-L6-v2, 384d).

Loads the model once (singleton) and provides encode/encode_batch.
No external API calls — fully local.
"""
import logging
import numpy as np
import subprocess
import sys
import os

logger = logging.getLogger(__name__)

_MODEL = None
_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_EMBEDDING_DIM = 384

# Cache file to avoid re-testing sentence-transformers on every restart
_ST_CACHE_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    ".st_available"
)


def _check_sentence_transformers_available() -> bool:
    """Test if sentence_transformers can be imported without hanging.

    On some Windows systems the torch DLL fails to initialize and hangs
    the import indefinitely. We test in a subprocess with a timeout.
    Result is cached to a file so the check runs only once.
    """
    if os.path.exists(_ST_CACHE_FILE):
        with open(_ST_CACHE_FILE) as f:
            return f.read().strip() == "1"
    try:
        result = subprocess.run(
            [sys.executable, "-c",
             "import sentence_transformers; print('ok')"],
            capture_output=True, text=True, timeout=15,
        )
        available = result.returncode == 0 and result.stdout.strip() == "ok"
    except (subprocess.TimeoutExpired, Exception):
        available = False
    try:
        os.makedirs(os.path.dirname(_ST_CACHE_FILE), exist_ok=True)
        with open(_ST_CACHE_FILE, "w") as f:
            f.write("1" if available else "0")
    except Exception:
        pass
    return available


def _get_model():
    global _MODEL
    if _MODEL is None:
        if _check_sentence_transformers_available():
            try:
                from sentence_transformers import SentenceTransformer
                _MODEL = SentenceTransformer(_MODEL_NAME)
                logger.info("Embedding model '%s' loaded (dim=%d).",
                            _MODEL_NAME, _EMBEDDING_DIM)
                return _MODEL
            except Exception as exc:
                logger.warning(
                    "sentence-transformers/torch not usable (%s). "
                    "Falling back to deterministic hash-based embeddings (384d). "
                    "Install torch properly or use WSL for full support.",
                    exc
                )
        else:
            logger.warning(
                "sentence_transformers import timed out or failed "
                "(broken torch DLL on Windows). "
                "Falling back to deterministic hash-based embeddings (384d)."
            )
        _MODEL = _DummyModel()
    return _MODEL


class _DummyModel:
    """Fallback model when sentence-transformers/torch is unavailable.

    API-compatible with SentenceTransformer.encode():
        encode(text: str | list[str], ...) -> list[float] | list[list[float]]
    Uses deterministic hash-based pseudo-embeddings (384d).
    """

    def encode(self, texts: str | list[str], **kwargs) -> list[float] | list[list[float]]:
        normalize = kwargs.get("normalize_embeddings", True)
        single = isinstance(texts, str)
        if single:
            texts = [texts]
        results = []
        for t in texts:
            rng = np.random.default_rng(hash(t) % (2**31))
            vec = rng.random(_EMBEDDING_DIM).astype(np.float32)
            if normalize:
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm
            results.append(vec.tolist())
        return results[0] if single else results

    def encode_multi_process(self, texts: list[str], pool: object,
                             **kwargs) -> list[list[float]]:
        return self.encode(texts, **kwargs)  # type: ignore

    def start_multi_process_pool(self) -> dict:
        return {}  # not used in fallback


def encode(text: str, normalize: bool = True) -> list[float]:
    """Encode a single text string to a 384-dim vector."""
    model = _get_model()
    vec = model.encode(text, normalize_embeddings=normalize)
    if isinstance(vec, np.ndarray):
        return vec.astype(np.float32).tolist()
    return list(vec)


def encode_batch(
    texts: list[str],
    normalize: bool = True,
    show_progress_bar: bool = False,
) -> list[list[float]]:
    """Encode a list of texts in one batch call."""
    if not texts:
        return []
    model = _get_model()
    emb = model.encode(
        texts,
        normalize_embeddings=normalize,
        show_progress_bar=show_progress_bar,
    )
    if isinstance(emb, np.ndarray):
        return emb.astype(np.float32).tolist()
    return [list(v) for v in emb]


def get_dimension() -> int:
    """Return the embedding dimension (384 for all-MiniLM-L6-v2)."""
    return _EMBEDDING_DIM

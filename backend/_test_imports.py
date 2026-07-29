"""Test that the vector store + services import chain works."""
import os, sys, types
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
treasury_dir = os.path.dirname(current_dir)
grew_analytics_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))

for path in [grew_analytics_root, treasury_dir, current_dir]:
    env_file = os.path.join(path, '.env')
    if os.path.exists(env_file):
        load_dotenv(dotenv_path=env_file, override=True)

sys.path.insert(0, grew_analytics_root)

for mod_name, mod_path in [('apps', []), ('packages', [])]:
    if mod_name not in sys.modules:
        m = types.ModuleType(mod_name)
        m.__path__ = mod_path
        sys.modules[mod_name] = m

if 'apps.Treasury' not in sys.modules:
    treasury_mod = types.ModuleType('apps.Treasury')
    treasury_mod.__path__ = [treasury_dir]
    sys.modules['apps.Treasury'] = treasury_mod

if 'packages.contracts' not in sys.modules:
    contracts = types.ModuleType('packages.contracts')
    sys.modules['packages.contracts'] = contracts
    contracts.IRepository = type('IRepository', (object,), {})
    contracts.PlatformModule = type('PlatformModule', (object,), {})

import sys
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Test 1: Import VectorStore
from apps.Treasury.backend.vector_store import VectorStore, SearchResult, PgJsonbVectorStore
print("[OK] vector_store imports OK")

# Test 2: Instantiate PgJsonbVectorStore
store = PgJsonbVectorStore()
print(f"✅ PgJsonbVectorStore instantiated: {type(store).__name__}")

# Test 3: Initialize (creates tables)
store.initialize()
print("✅ PgJsonbVectorStore initialized (tables created/verified)")

# Test 4: Basic operations
count = store.count("code_embeddings")
print(f"✅ count(code_embeddings) = {count}")

# Test 5: Import embedding service (may use dummy if sentence-transformers not installed)
from apps.Treasury.backend.services.embedding_service import encode, encode_batch, get_dimension
dim = get_dimension()
print(f"✅ embedding_service dim={dim}")

vec = encode("test query")
print(f"✅ encode('test query') -> {len(vec)} floats, first={vec[0]:.4f}")

# Test 6: Upsert + search
from apps.Treasury.backend.services.retrieval_service import retrieve_context, format_context

result_id = store.upsert("code_embeddings", vec, "def test(): pass", {"test": True})
print(f"✅ upsert -> id={result_id}")

results = store.search("code_embeddings", vec, top_k=3)
print(f"✅ search -> {len(results)} results, top score={results[0].score if results else 'N/A'}")

# Test 7: Import repo_indexer
from apps.Treasury.backend.services.repo_indexer import index_repository, _walk_repo, _chunk_file
print("✅ repo_indexer imports OK")

# Test 8: Count files in repo
files = list(_walk_repo(treasury_dir))
print(f"✅ repo has {len(files)} indexable files")

# Test 9: Cleanup
deleted_count = store.clear("code_embeddings")
print(f"✅ cleared code_embeddings: {deleted_count} deleted")

print("\n🎉 All import and integration tests passed!")

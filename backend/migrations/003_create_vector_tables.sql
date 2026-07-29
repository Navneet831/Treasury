-- ═══════════════════════════════════════════════════════════════
-- Migration 003: Create vector embedding tables (JSONB fallback)
-- ═══════════════════════════════════════════════════════════════
-- pgvector extension is not available on PG 16.14, so embeddings
-- are stored as JSONB arrays. Cosine similarity is computed in
-- Python (numpy) behind the abstract VectorStore interface.
--
-- When pgvector is eventually installed, replace JSONB columns
-- with vector(384) type and use <=> operator for speed.
-- ═══════════════════════════════════════════════════════════════

-- 1. Code embeddings (source code chunks)
CREATE TABLE IF NOT EXISTS code_embeddings (
    id          SERIAL PRIMARY KEY,
    content     TEXT NOT NULL,
    embedding   JSONB NOT NULL,
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_gin_meta
    ON code_embeddings USING GIN (metadata);

COMMENT ON TABLE code_embeddings IS
    'Vector embeddings of source code chunks (functions, classes) for RAG search';
COMMENT ON COLUMN code_embeddings.embedding IS
    '384-dim float array from all-MiniLM-L6-v2, stored as JSONB';

-- 2. Document embeddings (README, docs, config files)
CREATE TABLE IF NOT EXISTS document_embeddings (
    id          SERIAL PRIMARY KEY,
    content     TEXT NOT NULL,
    embedding   JSONB NOT NULL,
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_gin_meta
    ON document_embeddings USING GIN (metadata);

COMMENT ON TABLE document_embeddings IS
    'Vector embeddings of documentation files (md, txt, config) for RAG search';

-- 3. Schema embeddings (DB table/column descriptions)
CREATE TABLE IF NOT EXISTS schema_embeddings (
    id          SERIAL PRIMARY KEY,
    content     TEXT NOT NULL,
    embedding   JSONB NOT NULL,
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_schema_embeddings_gin_meta
    ON schema_embeddings USING GIN (metadata);

COMMENT ON TABLE schema_embeddings IS
    'Vector embeddings of database schema descriptions for RAG search';

-- 4. Prompt embeddings (historical developer Q&A pairs)
CREATE TABLE IF NOT EXISTS prompt_embeddings (
    id          SERIAL PRIMARY KEY,
    content     TEXT NOT NULL,
    embedding   JSONB NOT NULL,
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prompt_embeddings_gin_meta
    ON prompt_embeddings USING GIN (metadata);

COMMENT ON TABLE prompt_embeddings IS
    'Vector embeddings of historical developer Q&A prompts for RAG search';

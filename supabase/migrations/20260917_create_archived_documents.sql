-- ==============================================================================
-- Migration: Create archived_documents Table for Centralized Document Management
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.archived_documents (
    id TEXT PRIMARY KEY,
    archive_code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    reference_number VARCHAR(100) NOT NULL,
    client_or_entity VARCHAR(255) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    file_name VARCHAR(255),
    file_size BIGINT,
    file_data_url TEXT,
    notes TEXT,
    tags TEXT[],
    source_module VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for fast search and filtering
CREATE INDEX IF NOT EXISTS idx_archived_docs_code ON public.archived_documents(archive_code);
CREATE INDEX IF NOT EXISTS idx_archived_docs_category ON public.archived_documents(category);
CREATE INDEX IF NOT EXISTS idx_archived_docs_ref ON public.archived_documents(reference_number);
CREATE INDEX IF NOT EXISTS idx_archived_docs_client ON public.archived_documents(client_or_entity);

-- Enable RLS and public access policies
ALTER TABLE public.archived_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on archived_documents"
    ON public.archived_documents FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert on archived_documents"
    ON public.archived_documents FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update on archived_documents"
    ON public.archived_documents FOR UPDATE
    USING (true);

CREATE POLICY "Allow public delete on archived_documents"
    ON public.archived_documents FOR DELETE
    USING (true);

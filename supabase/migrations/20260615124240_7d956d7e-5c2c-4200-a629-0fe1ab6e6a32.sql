
-- =========================================================================
-- AI Intake Bar — Datenmodell (additiv, keine bestehenden Objekte verändert)
-- =========================================================================

-- ---------- ai_conversations ----------
CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  language text,
  status text NOT NULL DEFAULT 'active',
  inquiry_id uuid,
  customer_email text,
  source text NOT NULL DEFAULT 'ai_intake_bar',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and staff can read ai_conversations"
ON public.ai_conversations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'staff'::app_role));

CREATE TRIGGER ai_conversations_set_updated_at
BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ai_conversations_inquiry_id ON public.ai_conversations(inquiry_id);
CREATE INDEX idx_ai_conversations_status ON public.ai_conversations(status);
CREATE INDEX idx_ai_conversations_created_at ON public.ai_conversations(created_at DESC);


-- ---------- ai_messages ----------
CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ai_messages_role_check CHECK (role IN ('user', 'assistant', 'system'))
);

GRANT SELECT ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and staff can read ai_messages"
ON public.ai_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'staff'::app_role));

CREATE INDEX idx_ai_messages_conversation_id ON public.ai_messages(conversation_id, created_at);


-- ---------- ai_extractions ----------
CREATE TABLE public.ai_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  missing_fields text[] NOT NULL DEFAULT '{}',
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_extractions TO authenticated;
GRANT ALL ON public.ai_extractions TO service_role;

ALTER TABLE public.ai_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and staff can read ai_extractions"
ON public.ai_extractions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'staff'::app_role));

CREATE INDEX idx_ai_extractions_conversation_id ON public.ai_extractions(conversation_id, created_at DESC);


-- ---------- knowledge_sources ----------
CREATE TABLE public.knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_ref text,
  title text,
  status text NOT NULL DEFAULT 'active',
  last_indexed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.knowledge_sources TO authenticated;
GRANT ALL ON public.knowledge_sources TO service_role;

ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and staff can read knowledge_sources"
ON public.knowledge_sources FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'staff'::app_role));

CREATE TRIGGER knowledge_sources_set_updated_at
BEFORE UPDATE ON public.knowledge_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ---------- knowledge_documents ----------
CREATE TABLE public.knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  path text,
  title text,
  content text,
  content_hash text,
  locale text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.knowledge_documents TO authenticated;
GRANT ALL ON public.knowledge_documents TO service_role;

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and staff can read knowledge_documents"
ON public.knowledge_documents FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'staff'::app_role));

CREATE TRIGGER knowledge_documents_set_updated_at
BEFORE UPDATE ON public.knowledge_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_knowledge_documents_source_id ON public.knowledge_documents(source_id);
CREATE INDEX idx_knowledge_documents_status ON public.knowledge_documents(status);
CREATE INDEX idx_knowledge_documents_content_hash ON public.knowledge_documents(content_hash);


-- ---------- knowledge_chunks ----------
-- Hinweis: pgvector ist im Projekt nicht aktiv, daher embedding als jsonb
-- (kann später ohne Datenverlust auf vector migriert werden).
CREATE TABLE public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  embedding jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and staff can read knowledge_chunks"
ON public.knowledge_chunks FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'staff'::app_role));

CREATE INDEX idx_knowledge_chunks_document_id ON public.knowledge_chunks(document_id, chunk_index);


-- ---------- inquiry_attachments ----------
-- inquiry_id bleibt nullable: Uploads erfolgen vor finalem Submit und werden
-- erst nach erfolgreicher Anfrage-Erzeugung mit der inquiry/v2_events-ID verknüpft.
CREATE TABLE public.inquiry_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by text NOT NULL DEFAULT 'customer',
  source text NOT NULL DEFAULT 'ai_intake_bar',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.inquiry_attachments TO authenticated;
GRANT ALL ON public.inquiry_attachments TO service_role;

ALTER TABLE public.inquiry_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and staff can read inquiry_attachments"
ON public.inquiry_attachments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'staff'::app_role));

CREATE INDEX idx_inquiry_attachments_inquiry_id ON public.inquiry_attachments(inquiry_id);
CREATE INDEX idx_inquiry_attachments_conversation_id ON public.inquiry_attachments(conversation_id);
CREATE INDEX idx_inquiry_attachments_created_at ON public.inquiry_attachments(created_at DESC);

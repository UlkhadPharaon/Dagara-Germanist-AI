-- ============================================================================
-- Dagara Germanist AI — initial schema
-- ============================================================================
-- Tables: projects, project_versions, generations
-- Row Level Security is enabled on every table: users can only ever touch
-- their own rows. The service role (edge functions) bypasses RLS for usage
-- logging only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- projects — one row per research project
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  -- Same id format as the legacy localStorage implementation (Date.now().toString())
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Nouveau Projet',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT now(),
  subject TEXT NOT NULL DEFAULT '',
  cycle TEXT NOT NULL DEFAULT '1er cycle (6ème-3ème)',
  context TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'fr' CHECK (language IN ('fr', 'de')),
  literature_review JSONB,
  hypotheses TEXT[] NOT NULL DEFAULT '{}',
  questions TEXT[] NOT NULL DEFAULT '{}',
  objectives_json JSONB NOT NULL DEFAULT '{"general":"","specific":[]}',
  tools_json JSONB NOT NULL DEFAULT '{}',
  analyses_json JSONB NOT NULL DEFAULT '[]',
  bibliography_json JSONB,
  -- Collaboration: user ids (or emails) granted access to this project.
  shared_with TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects (user_id, updated_at DESC);

-- ----------------------------------------------------------------------------
-- project_versions — snapshot per save, used for restore
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_versions (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  version_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_versions_project ON project_versions (project_id, version_number DESC);

-- ----------------------------------------------------------------------------
-- generations — usage / billing telemetry
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  phase TEXT NOT NULL CHECK (phase IN ('phase0', 'phase1', 'phase2', 'phase3', 'phase4')),
  tool_type TEXT,
  model_used TEXT,
  tokens_estimated INTEGER CHECK (tokens_estimated IS NULL OR tokens_estimated >= 0),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generations_user_date ON generations (user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

-- projects: owner or explicitly shared-with collaborator
DROP POLICY IF EXISTS "Users can view own or shared projects" ON projects;
CREATE POLICY "Users can view own or shared projects"
  ON projects FOR SELECT
  USING (
    auth.uid() = user_id
    OR shared_with ? ARRAY[auth.uid()]::text[]
  );

DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own projects" ON projects;
CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- project_versions: only through project ownership
DROP POLICY IF EXISTS "Users can view own project versions" ON project_versions;
CREATE POLICY "Users can view own project versions"
  ON project_versions FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own project versions" ON project_versions;
CREATE POLICY "Users can insert own project versions"
  ON project_versions FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own project versions" ON project_versions;
CREATE POLICY "Users can delete own project versions"
  ON project_versions FOR DELETE
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- generations: read-only for the owner, insert-only for the service role
DROP POLICY IF EXISTS "Users can view own generations" ON generations;
CREATE POLICY "Users can view own generations"
  ON generations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert generations" ON generations;
CREATE POLICY "Service role can insert generations"
  ON generations FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Keep updated_at honest on every write
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Realtime: multi-tab / multi-device sync (T2.6)
-- ----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE projects;

# 08 — Deployment & Operations

## Infrastructure Requirements

### Vercel (Primary Hosting)

| Requirement | Detail |
|-------------|--------|
| Plan | Pro tier (required for Edge Functions, Analytics, custom domains) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Git Integration | Push to `main` branch → auto-deploy to production; push to `develop` → auto-deploy to staging |
| Environment Variables | Configured in Vercel dashboard (not committed to repo) |
| Domain | Custom domain configured in Vercel project settings |

### Supabase (Database + Auth)

| Requirement | Detail |
|-------------|--------|
| Plan | Team plan minimum ($25/month) — provides auth, PostgreSQL, Realtime, storage |
| Region | `eu-west-3` (Paris) or `us-east-1` — closer to West African users |
| Database | PostgreSQL 15+ with three tables: `projects`, `project_versions`, `generations` |
| Auth | Email/password + Google OAuth (configured in Supabase dashboard) |
| Row-Level Security | Policies per-table controlling read/write access by user_id |
| Realtime | Enabled on `projects` table for multi-tab sync |
| Storage | Optional: for file archives if feature added later |

### Sentry (Error Monitoring)

| Requirement | Detail |
|-------------|--------|
| Plan | Team plan (free tier supports basic monitoring) |
| DSN | Configured as environment variable |
| Source Maps | Uploaded automatically during Vercel build |
| Alerts | Email alert on error spike detection |

### NVIDIA GPU Cloud (AI Inference)

| Requirement | Detail |
|-------------|--------|
| Account | Active NVIDIA NGC account with API key starting with `nvapi-` |
| Accepted Models | meta/llama-3.1-70b-instruct, nvidia/llama-3.1-nemotron-70b-instruct, mistralai/mistral-large-2-instruct |
| Rate Limits | Depends on tier; implement client-side exponential backoff retry |
| Cost Model | Pay-per-token or pay-per-GPU-hour; track usage for budget management |

---

## Environment Variables (Names Only, No Values)

These must be configured in **both** Vercel project settings and local `.env` file (if developing locally):

| Variable | Required | Default | Used By | Notes |
|----------|----------|---------|---------|-------|
| `SUPABASE_URL` | Yes | N/A | Frontend app, edge function | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | N/A | Frontend app | Public anon key (client-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | N/A | Edge function only | Server-side RLS bypass; NEVER expose to client |
| `NVIDIA_API_KEY` | Yes | N/A | Edge function | NVIDIA GPU Cloud API key (`nvapi-*`) |
| `SENTRY_DSN` | No | Empty string | Frontend, edge function, server | Sentry project DSN |
| `VERCEL_ENV` | Auto-set | development | Build process | Set automatically by Vercel: `development`, `preview`, `production` |
| `NEXT_PUBLIC_SITE_URL` | No | Auto-detected | Marketing site | Canonical URL for SEO/OpenGraph |

⚠️ **NEVER commit actual key values.** Use `.env.example` as template and fill values through CI/CD secret injection or manual dashboard entry.

---

## Database Schema

### Table: `projects`

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,                    -- Same ID format as current (Date.now().toString())
  user_id TEXT NOT NULL REFERENCES auth.users(id),
  name TEXT DEFAULT 'Nouveau Projet',
  last_modified TIMESTAMPTZ DEFAULT now(),
  subject TEXT DEFAULT '',
  cycle TEXT DEFAULT '1er cycle (6ème-3ème)',
  context TEXT DEFAULT '',
  language TEXT DEFAULT 'fr' CHECK (language IN ('fr', 'de')),
  literature_review JSONB,                -- null until Phase 0 generated
  hypotheses TEXT[] DEFAULT '{}',         -- Array of strings
  questions TEXT[] DEFAULT '{}',          -- Array of strings
  objectives_json JSONB DEFAULT '{"general": "", "specific": []}',
  tools_json JSONB DEFAULT '{}',          -- {toolId: markdown_content}
  analyses_json JSONB DEFAULT '[]',       -- Array of AnalysisResult
  bibliography_json JSONB,                -- null until Phase 4 generated
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast user queries
CREATE INDEX idx_projects_user ON projects(user_id, updated_at DESC);
```

### Table: `project_versions` (Snapshot history)

```sql
CREATE TABLE project_versions (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,               -- Full ProjectData at point in time
  version_number INTEGER NOT NULL,        -- Incremented per save
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_versions_project ON project_versions(project_id, version_number DESC);
```

### Table: `generations` (Usage tracking)

```sql
CREATE TABLE generations (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth.users(id),
  project_id TEXT REFERENCES projects(id),
  phase TEXT NOT NULL CHECK (phase IN ('phase0', 'phase1', 'phase2', 'phase3', 'phase4')),
  tool_type TEXT,                         -- For Phase 2: 'enseignants', 'eleves', etc.
  model_used TEXT,                        -- e.g., 'meta/llama-3.1-70b-instruct'
  tokens_estimated INTEGER,               -- Approximate token count
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'cancelled')),
  error_message TEXT,                     -- If failed
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_generations_user_date ON generations(user_id, created_at);
```

### Row-Level Security Policies

```sql
-- Projects: users can only read/write their own projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Shared project override (for institutional collaboration):
CREATE POLICY "Shared projects visible to team members" ON projects
  FOR SELECT USING (user_id = auth.uid() OR shared_with ? ARRAY[auth.uid()]::text[]);

-- Project versions: follow same ownership rules
ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own project versions" ON project_versions FOR SELECT USING (
  project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
);

-- Generations: users see only their own data
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own generations" ON generations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert generations" ON generations FOR INSERT TO service_role WITH CHECK (true);
```

---

## Migration Instructions

### Pre-deployment Checklist

- [ ] All environment variables configured in Vercel dashboard
- [ ] Supabase database schema applied (run migrations from `supabase/migrations/`)
- [ ] RLS policies verified via SQL in Supabase SQL editor
- [ ] Sentry project created and DSN noted
- [ ] NVIDIA API key tested against `/api/nvidia/chat/completions` proxy endpoint
- [ ] Custom domain DNS pointed to Vercel (NS records updated)
- [ ] SSL certificate active (Vercel handles this automatically)
- [ ] Staging branch deployed and smoke tests passing
- [ ] Production deploy queued

### Post-deployment Verification

Run all smoke tests from `07_TESTING_AND_ACCEPTANCE_MATRIX.md` section "Production Smoke Tests."

If any smoke test fails: rollback to previous deployment immediately. Do not attempt to fix in production without first reproducing in staging.

---

## Backup Strategy

| Component | Backup Method | Frequency | Retention |
|-----------|--------------|-----------|-----------|
| Supabase database | Supabase automated backups (Pro plan) | Every 6 hours | 7 days |
| Supabase database | Manual dump via `pg_dump` script | Weekly | 30 days |
| Vercel deployments | Version control (Git) | On each git push | Indefinite |
| Local projects (pre-migration) | User-initiated .json export | User-dependent | User-managed |

### Backup Recovery Procedure

1. Identify failure scope (entire DB vs specific project)
2. For full DB recovery: restore from latest backup via Supabase dashboard
3. For individual project recovery: restore from `project_versions` table (version history)
4. Verify restored data integrity before exposing to users

---

## Rollback Strategy

### Vercel Rollback
1. Go to Vercel Dashboard → Deployments
2. Click previous successful deployment → "Redeploy"
3. Instant rollback — no code changes needed
4. Set `$ VERCEL_PROJECT_PRODUCTION_URL` pointer back

### Database Rollback
1. Run migration script in reverse order (drop new tables/columns)
2. Restore from pg_dump backup if data corrupted
3. Notify affected users via email/in-app notification

### Emergency Contact Chain
1. Developer → checks staging environment
2. If reproducible in staging → fix and redeploy
3. If only in production → rollback first, debug later

-- Track cron job execution history for admin dashboard
CREATE TABLE IF NOT EXISTS cron_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  result JSONB,
  error_message TEXT,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for admin dashboard queries
CREATE INDEX idx_cron_job_runs_job_name ON cron_job_runs(job_name);
CREATE INDEX idx_cron_job_runs_completed_at ON cron_job_runs(completed_at DESC);

-- RLS: only service role can insert, admins can read
ALTER TABLE cron_job_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage cron_job_runs"
  ON cron_job_runs FOR ALL
  USING (true)
  WITH CHECK (true);

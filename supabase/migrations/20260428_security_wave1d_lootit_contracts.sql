-- ============================================================
-- Wave 1D — document lootit_contracts schema + tighten RLS
-- ============================================================
-- The lootit_contracts table and lootit-contracts storage bucket
-- existed only in production (created via Supabase dashboard).
-- This migration captures their schema so a fresh environment can be
-- spun up reproducibly. Also closes a tenant-leak on the table.

-- Table
CREATE TABLE IF NOT EXISTS lootit_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  uploaded_by UUID,
  extracted_data JSONB DEFAULT '{}'::jsonb,
  extraction_status TEXT DEFAULT 'pending',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lootit_contracts_customer_id
  ON lootit_contracts(customer_id);

ALTER TABLE lootit_contracts ENABLE ROW LEVEL SECURITY;

-- Drop the broad authenticated-read policy that leaked all tenants'
-- contracts.
DROP POLICY IF EXISTS "Authenticated read" ON lootit_contracts;

-- Re-create policies (idempotent if already present).
DROP POLICY IF EXISTS "Admin full access" ON lootit_contracts;
DROP POLICY IF EXISTS "Customer read own" ON lootit_contracts;

CREATE POLICY "Admin full access"
  ON lootit_contracts FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Customer read own"
  ON lootit_contracts FOR SELECT
  USING (customer_id = user_customer_id());

-- Storage bucket — created via the Supabase dashboard, captured here
-- for reproducibility. INSERT is no-op if the bucket already exists.
INSERT INTO storage.buckets (id, name, public)
VALUES ('lootit-contracts', 'lootit-contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: only admins can read or write the bucket.
-- (Customers download contracts via signed URLs generated server-side.)
DROP POLICY IF EXISTS "Admin all on lootit-contracts" ON storage.objects;
CREATE POLICY "Admin all on lootit-contracts"
  ON storage.objects FOR ALL
  USING (bucket_id = 'lootit-contracts' AND is_admin())
  WITH CHECK (bucket_id = 'lootit-contracts' AND is_admin());

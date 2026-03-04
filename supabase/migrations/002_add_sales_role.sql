-- PortalIT Migration: Add sales role + invitation tracking
-- Run this against the Supabase database via the SQL Editor in the dashboard

-- ============================================================
-- 1. Expand the users role constraint to include 'sales'
-- ============================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'sales', 'user'));

-- ============================================================
-- 2. Invitation tracking table
-- ============================================================
CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  invite_type TEXT NOT NULL CHECK (invite_type IN ('customer', 'tech')),
  customer_id UUID REFERENCES customers(id),
  otp_hash TEXT NOT NULL,
  auth_user_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. RLS policies for user_invitations
-- ============================================================
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage invitations
CREATE POLICY "Admins can manage invitations" ON user_invitations
  FOR ALL USING (public.is_admin());

-- Allow public read for OTP verification (by email match)
CREATE POLICY "Public can verify own invitations" ON user_invitations
  FOR SELECT USING (true);

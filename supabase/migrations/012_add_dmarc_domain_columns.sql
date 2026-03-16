-- Add domain-level mapping columns to dmarc_report_mappings
ALTER TABLE dmarc_report_mappings ADD COLUMN IF NOT EXISTS dmarc_domain_id TEXT;
ALTER TABLE dmarc_report_mappings ADD COLUMN IF NOT EXISTS dmarc_domain_name TEXT;

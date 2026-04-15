-- Allow customer users to read their own CIPP mapping
-- Without this, customers see "No M365 Data Connected Yet" even when data exists
CREATE POLICY customer_cipp_mappings ON cipp_mappings
  FOR SELECT USING (customer_id = user_customer_id());

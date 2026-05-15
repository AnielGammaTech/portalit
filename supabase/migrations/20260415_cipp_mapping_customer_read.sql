-- Allow customer users to read their own CIPP and Pax8 mappings
-- Without this, customers see "No M365 Data Connected Yet" even when data exists
CREATE POLICY customer_cipp_mappings ON cipp_mappings
  FOR SELECT USING (customer_id = user_customer_id());

CREATE POLICY customer_pax8_mappings ON pax8_mappings
  FOR SELECT USING (customer_id = user_customer_id());

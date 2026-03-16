-- Add total_tickets column to customers for displaying true HaloPSA ticket count
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_tickets INTEGER DEFAULT 0;

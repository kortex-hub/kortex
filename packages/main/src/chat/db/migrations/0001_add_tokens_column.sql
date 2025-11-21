-- Migration: Add tokens column to Message table
-- This migration adds the tokens column for Message tables created before this column was added

-- For SQLite, ALTER TABLE ADD COLUMN will fail if the column already exists
-- Drizzle's migration system tracks which migrations have been applied, so this will only run once
-- If you need to manually apply this to an existing database, check if the column exists first

ALTER TABLE "Message" ADD COLUMN "tokens" integer DEFAULT 0;

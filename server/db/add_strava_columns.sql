-- Add Strava token columns to users table
-- Run this on your Supabase/Postgres database:
-- psql "postgres://user:password@host:port/dbname" -f add_strava_columns.sql

ALTER TABLE IF EXISTS public.users
ADD COLUMN IF NOT EXISTS strava_access_token TEXT,
ADD COLUMN IF NOT EXISTS strava_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS strava_token_expires_at BIGINT,
ADD COLUMN IF NOT EXISTS strava_athlete_id BIGINT;

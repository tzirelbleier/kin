-- ================================================================
-- Migration 004 — User management + editable routing config
-- ================================================================

-- Add soft-delete flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add per-facility routing config override (JSON, nullable = use defaults)
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS routing_config jsonb;

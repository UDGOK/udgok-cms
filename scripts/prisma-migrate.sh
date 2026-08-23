#!/usr/bin/env bash
# Prisma migrate — the safe non-destructive alternative to `db push`.
#
# Why this exists (Aug 2026 data-loss incident):
#   `prisma db push --accept-data-loss` was being used in production.
#   Adding new values to a Postgres ENUM silently dropped the entire
#   database. The previous safety check (`scripts/prisma-safety-check.sh`)
#   now prevents that from reaching the push step.
#
# This script does the actual schema sync. It does TWO things:
#
#   1. If `prisma/migrations/` has committed migrations, run
#      `prisma migrate deploy`. This applies ONLY the new migrations
#      and is the proper way to do schema evolution in production.
#
#   2. If there are no committed migrations (the current state of this
#      project — it's been `db push` since day 1), run
#      `prisma db push --skip-generate` WITHOUT `--accept-data-loss`.
#      The safety check ahead of this guarantees the diff is purely
#      additive, so `db push` will succeed without data loss.
#
# The right long-term path is to convert the project to migrations
# (see prisma/migrations/_migration_conversion_roadmap.md if I make
# one). For now, this script is the safety net that keeps us from
# ever silently dropping data again.

set -euo pipefail

# Use whichever env var is set. Vercel sets DATABASE_URL; in our
# local scripts we often use a project-specific name (e.g. RESTORE_URL).
DB_URL="${DATABASE_URL:-${RESTORE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "❌ no DATABASE_URL or RESTORE_URL set"
  exit 1
fi
export DATABASE_URL="$DB_URL"

# Count committed migrations. If there's at least one, use migrate
# deploy (the proper, non-destructive flow). If the directory doesn't
# exist (typical for projects still on db push), default to 0 so the
# script falls through to the db push branch.
if [ -d "prisma/migrations" ]; then
  MIGRATION_COUNT=$(find prisma/migrations -name "migration.sql" 2>/dev/null | wc -l | tr -d ' ')
else
  MIGRATION_COUNT=0
fi

if [ "$MIGRATION_COUNT" -gt 0 ]; then
  echo "Found $MIGRATION_COUNT committed migration(s). Using 'migrate deploy'."
  if command -v pnpm &>/dev/null; then
    pnpm exec prisma migrate deploy
  else
    npx prisma migrate deploy
  fi
else
  echo "No committed migrations found. Using 'db push' (safety check already"
  echo "verified the diff is purely additive)."
  if command -v pnpm &>/dev/null; then
    pnpm exec prisma db push --skip-generate
  else
    npx prisma db push --skip-generate
  fi
fi

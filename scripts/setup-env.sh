#!/usr/bin/env bash
# Build-time env normalization for Vercel.
#
# The project uses the UDGOK_CMS_* "smart prefix" convention on
# Vercel (user-side env vars are UDGOK_CMS_DATABASE_URL, etc.).
# The runtime env shim in next.config.mjs copies prefixed values
# into unprefixed names AT RUNTIME (serverless function boot).
#
# But build-time scripts (prisma-safety-check.sh, prisma-migrate.sh)
# run BEFORE next.config.mjs evaluates. They read DATABASE_URL
# directly. If only UDGOK_CMS_DATABASE_URL is set on Vercel, the
# build scripts see empty DATABASE_URL and fail.
#
# This script normalizes the build-time env: for any well-known
# unprefixed name (DATABASE_URL, RESEND_API_KEY, CLERK_*, BLOB_*),
# prefer the UDGOK_CMS_* prefixed value when the unprefixed one
# is empty. Source this script at the start of the build command.
set -euo pipefail

declare -A ALIASES=(
  [DATABASE_URL]="UDGOK_CMS_DATABASE_URL UDGOK_CMS_POSTGRES_URL UDGOK_CMS_POSTGRES_PRISMA_URL"
  [RESEND_API_KEY]="UDGOK_MESSAGING_RESEND_API_KEY"
  [CLERK_PUBLISHABLE_KEY]="NEXT_PUBLIC_UDGOKCMS_AUTHENTICATION_CLERK_PUBLISHABLE_KEY UDGOKCMS_AUTHENTICATION_CLERK_PUBLISHABLE_KEY"
  [NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY]="NEXT_PUBLIC_UDGOKCMS_AUTHENTICATION_CLERK_PUBLISHABLE_KEY UDGOKCMS_AUTHENTICATION_CLERK_PUBLISHABLE_KEY"
  [CLERK_SECRET_KEY]="UDGOKCMS_AUTHENTICATION_CLERK_SECRET_KEY"
  [CLERK_WEBHOOK_SECRET]="UDGOK_CMS_CLERK_WEBHOOK_SECRET"
  [BLOB_READ_WRITE_TOKEN]="UDGOK_BLOB_READ_WRITE_TOKEN"
  [NEXT_PUBLIC_APP_URL]="UDGOK_CMS_APP_URL"
  [CRON_SECRET]="UDGOK_CMS_CRON_SECRET"
  [APP_HASH_SALT]="UDGOK_CMS_APP_HASH_SALT"
  [UDGOK_CMS_MASTERS]="MASTERS"
)

for unprefixed in "${!ALIASES[@]}"; do
  if [ -z "${!unprefixed:-}" ]; then
    for prefixed in ${ALIASES[$unprefixed]}; do
      if [ -n "${!prefixed:-}" ]; then
        export "$unprefixed=${!prefixed}"
        echo "  [setup-env] $unprefixed <- $prefixed"
        break
      fi
    done
  fi
done

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ setup-env: DATABASE_URL is empty after alias resolution."
  echo "   Set UDGOK_CMS_DATABASE_URL (preferred) or DATABASE_URL on Vercel."
  exit 1
fi
echo "  [setup-env] DATABASE_URL scheme: $(echo "$DATABASE_URL" | cut -d: -f1)"

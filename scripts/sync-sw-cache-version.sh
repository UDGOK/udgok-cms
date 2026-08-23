#!/usr/bin/env bash
# Sync the PWA service worker cache version with the current git
# commit. Run this as part of the build command (or pre-commit
# hook) so a new code change ALWAYS invalidates the SW cache.
#
# Background (Aug 2026): the SW had CACHE_VERSION = 'udgok-v3' for
# 3+ deploys. The OLD cached HTML/JS bundles from those deploys
# continued to be served while the new server returned HTML
# referencing new bundle hashes. React's reconciler threw a
# "Server Components render" error in production and the user
# saw a broken page. The root cause was forgetting to bump the
# cache version.
#
# This script writes a fresh, content-derived version into
# public/sw.js right before `next build`. Vercel's static-asset
# CDN includes the file in its content hash, so a change to
# CACHE_VERSION produces a new public URL and the browser
# picks up the new SW on next load.
#
# The version string is human-readable: 'udgok-v<short-sha>-<date>'
# so it's easy to spot in DevTools → Application → Service Workers
# and verify a deploy actually invalidated the cache.

set -euo pipefail

SW_PATH="public/sw.js"

if [ ! -f "$SW_PATH" ]; then
  echo "❌ $SW_PATH not found — run from repo root"
  exit 1
fi

# Derive a short git SHA + ISO date. If git is unavailable
# (e.g. Vercel build with --no-ancestry), fall back to a
# timestamp.
if SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null); then
  TODAY=$(date -u +%Y-%m-%d)
  NEW_VERSION="udgok-v4-${SHORT_SHA}-${TODAY}"
else
  TODAY=$(date -u +%Y-%m-%dT%H-%M-%SZ)
  NEW_VERSION="udgok-v4-no-git-${TODAY}"
fi

# Replace any CACHE_VERSION = 'udgok-v...'; line with the new one.
# We use a sed that matches the prefix only, so we never overwrite
# unrelated constants.
TMP=$(mktemp)
sed -E "s|const CACHE_VERSION = 'udgok-v[^']*';|const CACHE_VERSION = '${NEW_VERSION}';|" \
  "$SW_PATH" > "$TMP"

# Sanity check: the new line must be present in the output.
if ! grep -q "const CACHE_VERSION = '${NEW_VERSION}';" "$TMP"; then
  echo "❌ Failed to update CACHE_VERSION in $SW_PATH"
  cat "$TMP"
  exit 1
fi

mv "$TMP" "$SW_PATH"
echo "✅ Updated CACHE_VERSION to ${NEW_VERSION} in $SW_PATH"

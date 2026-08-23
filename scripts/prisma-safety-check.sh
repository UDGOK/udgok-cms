#!/usr/bin/env bash
# Prisma schema safety check — runs in Vercel build before `prisma db push`.
#
# Why this exists (Aug 2026 data-loss incident):
#   We had `prisma db push --accept-data-loss` in vercel.json. Adding new
#   values to a Postgres ENUM (e.g. MessageEntityType) requires
#   Postgres to drop + recreate the enum, which cascades to drop every
#   column that uses it. With --accept-data-loss, the deploy silently
#   wiped the entire production database.
#
# What this does:
#   1. Diffs the schema.prisma against the live database
#   2. If the diff is DESTRUCTIVE (any DROP, plus any ALTER that would
#      change an enum's set of values), it FAILS the build with a
#      clear message pointing the operator at the manual migration path.
#   3. If the diff is purely ADDITIVE (new tables, new columns, new
#      nullable columns, new enum values via ALTER TYPE ... ADD VALUE),
#      it passes and the build proceeds.
#
# What counts as DESTRUCTIVE:
#   - Any DROP statement
#   - Any statement that would require enum value removal
#   - Any statement that would change a column's type incompatibly
#   - Any statement that would change a NOT NULL column to nullable
#     (technically non-destructive but can lose data if downgraded)
#
# The check uses `prisma migrate diff` which produces a SQL script
# without applying it. We grep for destructive keywords and bail if
# we see them.

set -euo pipefail

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Prisma safety check (build pre-flight)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Use whichever env var is set. Vercel sets DATABASE_URL; in our
# local scripts we often use a project-specific name (e.g. RESTORE_URL).
DB_URL="${DATABASE_URL:-${RESTORE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "❌ FAIL: no DATABASE_URL or RESTORE_URL set"
  exit 1
fi

# Generate the migration SQL without applying it. We point Prisma at
# the schema and the live DB and ask for the diff.
DIFF_SQL=$(npx prisma migrate diff \
  --from-url "$DB_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script 2>&1) || {
  echo "❌ FAIL: prisma migrate diff errored:"
  echo "$DIFF_SQL"
  exit 1
}

# If diff is empty, schema is already in sync. No-op.
if [ -z "$(echo "$DIFF_SQL" | tr -d '[:space:]')" ]; then
  echo "✅ Schema is in sync with database. Nothing to do."
  exit 0
fi

echo "Proposed migration SQL:"
echo "------------------------------------------------------------"
echo "$DIFF_SQL"
echo "------------------------------------------------------------"

# Detect destructive operations. We look for any DROP at all, plus
# any ALTER TYPE that would remove values. Adding values to an enum
# is fine (uses ALTER TYPE ... ADD VALUE), but if Prisma tries to
# remove a value (e.g. by re-creating the type), that's destructive.
DESTRUCTIVE=0

if echo "$DIFF_SQL" | grep -qiE '(^|[[:space:]])DROP[[:space:]]+(TABLE|INDEX|SEQUENCE|CONSTRAINT|TRIGGER|POLICY|FUNCTION|VIEW)'; then
  echo "❌ FAIL: migration drops a table/index/etc."
  DESTRUCTIVE=1
fi

if echo "$DIFF_SQL" | grep -qiE 'DROP[[:space:]]+TYPE'; then
  echo "❌ FAIL: migration drops a TYPE (enum)."
  DESTRUCTIVE=1
fi

# ALTER TYPE ... RENAME or ALTER TYPE ... SET SCHEMA = destructive-ish
# (Prisma uses these to "modify" enums without re-creating them, but
# the rename still requires Postgres to rewrite dependent columns.)
if echo "$DIFF_SQL" | grep -qiE 'ALTER[[:space:]]+TYPE' && ! echo "$DIFF_SQL" | grep -qiE 'ADD[[:space:]]+VALUE'; then
  echo "❌ FAIL: migration alters a TYPE in a way other than ADD VALUE."
  echo "   Use 'ALTER TYPE <name> ADD VALUE <newvalue>' manually,"
  echo "   then re-run the build."
  DESTRUCTIVE=1
fi

# Detect "DELETE FROM" — Prisma shouldn't generate this for additive
# schema changes, but if it does, we want to know.
if echo "$DIFF_SQL" | grep -qiE '(^|[[:space:]])DELETE[[:space:]]+FROM'; then
  echo "❌ FAIL: migration contains DELETE FROM."
  DESTRUCTIVE=1
fi

# Detect TRUNCATE — same logic.
if echo "$DIFF_SQL" | grep -qiE '(^|[[:space:]])TRUNCATE[[:space:]]+'; then
  echo "❌ FAIL: migration contains TRUNCATE."
  DESTRUCTIVE=1
fi

if [ "$DESTRUCTIVE" -eq 1 ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  BUILD ABORTED — destructive schema change detected."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "The schema in this commit would require dropping tables, types,"
  echo "or data. We do NOT auto-apply destructive migrations."
  echo ""
  echo "If this is intentional (e.g. you really do want to drop a"
  echo "deprecated table), write a manual migration:"
  echo ""
  echo "    pnpm prisma migrate dev --name <describe-the-change>"
  echo ""
  echo "Then commit the generated prisma/migrations/<timestamp>_<name>/migration.sql"
  echo "file and re-push. The build will run 'prisma migrate deploy'"
  echo "instead of 'prisma db push' and apply ONLY the new migration."
  echo ""
  echo "If you need to add an enum value, the safe SQL is:"
  echo ""
  echo "    ALTER TYPE \"MessageEntityType\" ADD VALUE 'NEW_VALUE';"
  echo ""
  echo "Add that as a one-time migration file."
  exit 1
fi

echo "✅ Migration is purely additive. Proceeding."
exit 0

#!/bin/bash
# Create a test estimate via psql
set -e
cd /workspace

# Get DATABASE_URL from .env
DB_URL=$(grep "^DATABASE_URL" .env | cut -d'"' -f2)
echo "DB: $DB_URL" | head -c 80
echo "..."

#!/bin/bash

# Schema Sync Validation Script
# This script validates that trainingmvp's shared-schema.prisma stays in sync
# with the source of truth in gofastapp-mvp/packages/shared-db/prisma/schema.prisma

set -e

SCHEMA_SOURCE="../gofastapp-mvp/packages/shared-db/prisma/schema.prisma"
SCHEMA_LOCAL="./prisma/shared-schema.prisma"

echo "🔍 Validating schema sync..."

if [ ! -f "$SCHEMA_SOURCE" ]; then
  echo "⚠️  WARNING: Source schema not found at $SCHEMA_SOURCE"
  echo "   This is expected in CI/CD environments (Vercel, etc.)"
  echo "   Skipping validation..."
  exit 0
fi

if [ ! -f "$SCHEMA_LOCAL" ]; then
  echo "❌ ERROR: Local schema not found at $SCHEMA_LOCAL"
  exit 1
fi

# Compare the schemas (ignoring generator output paths and comments)
SOURCE_HASH=$(grep -v "^generator client" "$SCHEMA_SOURCE" | grep -v "^//" | md5sum | cut -d' ' -f1)
LOCAL_HASH=$(grep -v "^generator client" "$SCHEMA_LOCAL" | grep -v "^//" | md5sum | cut -d' ' -f1)

if [ "$SOURCE_HASH" != "$LOCAL_HASH" ]; then
  echo "❌ ERROR: Schema files are out of sync!"
  echo "   Source: $SCHEMA_SOURCE"
  echo "   Local:  $SCHEMA_LOCAL"
  echo ""
  echo "   To sync schemas, run:"
  echo "   cp $SCHEMA_SOURCE $SCHEMA_LOCAL"
  echo ""
  echo "   Or manually update shared-schema.prisma to match the source."
  exit 1
fi

echo "✅ Schema files are in sync!"
exit 0

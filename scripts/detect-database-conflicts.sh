#!/bin/bash
# Detect Database Conflicts - Check if multiple projects share the same database

echo "🔍 Database Conflict Detection"
echo "=============================="
echo ""

# Get current project's DATABASE_URL
if [ -f .env.local ]; then
  CURRENT_DB=$(grep DATABASE_URL .env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'")
  echo "Current project DATABASE_URL: ${CURRENT_DB:0:50}..."
else
  echo "❌ No .env.local found"
  exit 1
fi

# Extract database name/host from URL
DB_HOST=$(echo $CURRENT_DB | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_NAME=$(echo $CURRENT_DB | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "Database Host: $DB_HOST"
echo "Database Name: $DB_NAME"
echo ""

# Check for other projects using same database
echo "Checking other projects for database conflicts..."
echo ""

CONFLICTS=0

# Check f3invigorate
if [ -d "../f3invigorate" ]; then
  if [ -f "../f3invigorate/.env.local" ]; then
    F3_DB=$(grep DATABASE_URL ../f3invigorate/.env.local 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    if [ "$F3_DB" = "$CURRENT_DB" ]; then
      echo "❌ CONFLICT: f3invigorate uses the SAME database!"
      CONFLICTS=1
    fi
  fi
fi

# Check gofastapp-mvp
if [ -d "../gofastapp-mvp" ]; then
  if [ -f "../gofastapp-mvp/.env.local" ]; then
    GOFAST_DB=$(grep DATABASE_URL ../gofastapp-mvp/.env.local 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    if [ "$GOFAST_DB" = "$CURRENT_DB" ]; then
      echo "⚠️  WARNING: gofastapp-mvp uses the SAME database (may be intentional)"
    fi
  fi
fi

# Check trainingmvp
if [ -d "../trainingmvp" ] && [ "$(basename $(pwd))" != "trainingmvp" ]; then
  if [ -f "../trainingmvp/.env.local" ]; then
    TRAINING_DB=$(grep DATABASE_URL ../trainingmvp/.env.local 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    if [ "$TRAINING_DB" = "$CURRENT_DB" ]; then
      echo "❌ CONFLICT: trainingmvp uses the SAME database!"
      CONFLICTS=1
    fi
  fi
fi

echo ""
if [ $CONFLICTS -eq 1 ]; then
  echo "❌ DATABASE CONFLICTS DETECTED!"
  echo ""
  echo "⚠️  CRITICAL: Multiple projects sharing the same database can cause:"
  echo "   - Data loss when one project runs migrations"
  echo "   - Schema conflicts"
  echo "   - Unintended data deletion"
  echo ""
  echo "✅ SOLUTION: Use separate databases for each project"
  exit 1
else
  echo "✅ No conflicts detected"
  exit 0
fi


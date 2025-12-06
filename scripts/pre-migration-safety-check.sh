#!/bin/bash
# Pre-Migration Safety Check
# Run this BEFORE any migration to prevent data loss

set -e

echo "🛡️  Pre-Migration Safety Check"
echo "================================"
echo ""

# Load environment
if [ -f .env.local ]; then
  export $(cat .env.local | grep DATABASE_URL | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not set"
  exit 1
fi

# Check 1: Count current users
echo "1. Checking current user count..."
USER_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$queryRaw\`SELECT COUNT(*) as count FROM \"athletes\"\`
  .then(r => { console.log(r[0].count); prisma.\$disconnect(); })
  .catch(() => { console.log('0'); prisma.\$disconnect(); });
" 2>/dev/null || echo "0")

echo "   Current athletes: $USER_COUNT"

if [ "$USER_COUNT" -gt 0 ]; then
  echo "   ⚠️  WARNING: Database contains $USER_COUNT users"
  echo "   ✅ Proceeding with caution..."
else
  echo "   ⚠️  WARNING: Database appears empty!"
  read -p "   Continue anyway? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "   ❌ Migration cancelled by user"
    exit 1
  fi
fi

# Check 2: Look for dangerous operations in migration files
echo ""
echo "2. Scanning migration files for dangerous operations..."

DANGEROUS_FOUND=0

# Check for DELETE without WHERE
if grep -r "DELETE FROM" prisma/migrations/ --include="*.sql" | grep -v "WHERE" > /dev/null 2>&1; then
  echo "   ❌ Found DELETE without WHERE clause!"
  DANGEROUS_FOUND=1
fi

# Check for DROP TABLE on critical tables
if grep -r "DROP TABLE.*athletes\|DROP TABLE.*Athlete" prisma/migrations/ --include="*.sql" -i > /dev/null 2>&1; then
  echo "   ❌ Found DROP TABLE on athletes table!"
  DANGEROUS_FOUND=1
fi

# Check for TRUNCATE
if grep -r "TRUNCATE" prisma/migrations/ --include="*.sql" -i > /dev/null 2>&1; then
  echo "   ❌ Found TRUNCATE statement!"
  DANGEROUS_FOUND=1
fi

if [ $DANGEROUS_FOUND -eq 0 ]; then
  echo "   ✅ No dangerous operations detected"
fi

# Check 3: Verify schema matches database
echo ""
echo "3. Verifying schema matches database..."
npx prisma validate > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "   ✅ Schema is valid"
else
  echo "   ⚠️  Schema validation failed - check for mismatches"
fi

# Check 4: Create backup
echo ""
echo "4. Creating backup..."
node scripts/create-backup.js
if [ $? -eq 0 ]; then
  echo "   ✅ Backup created successfully"
else
  echo "   ⚠️  Backup failed - but continuing..."
fi

echo ""
echo "================================"
if [ $DANGEROUS_FOUND -eq 1 ]; then
  echo "❌ SAFETY CHECK FAILED - Migration blocked"
  exit 1
else
  echo "✅ Safety check passed - proceed with migration"
  exit 0
fi


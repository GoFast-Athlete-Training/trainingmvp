#!/bin/bash
# Shared Database Safety Check
# For projects that INTENTIONALLY share the same database (like Athlete table)

set -e

echo "🛡️  Shared Database Safety Check"
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

# Check 1: Count current users BEFORE any operation
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
  echo "   ✅ Database contains $USER_COUNT users - proceed with caution"
else
  echo "   ⚠️  WARNING: Database appears empty!"
  echo "   This could indicate data loss or wrong database connection"
  read -p "   Continue anyway? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "   ❌ Operation cancelled by user"
    exit 1
  fi
fi

# Check 2: Block dangerous commands
echo ""
echo "2. Checking for dangerous operations..."

# Check if this is a db push with --accept-data-loss
if echo "$*" | grep -q "db push.*--accept-data-loss\|--accept-data-loss.*db push"; then
  echo "   ❌ BLOCKED: 'db push --accept-data-loss' is FORBIDDEN on shared databases!"
  echo ""
  echo "   This command will DROP and recreate tables, wiping all data."
  echo "   Since this database is shared with other projects, this is DANGEROUS."
  echo ""
  echo "   ✅ SAFE ALTERNATIVES:"
  echo "   - Use 'prisma migrate dev' to create migrations"
  echo "   - Review migration SQL before applying"
  echo "   - Use 'prisma migrate deploy' for production"
  exit 1
fi

# Check if this is a migrate reset
if echo "$*" | grep -q "migrate reset"; then
  echo "   ❌ BLOCKED: 'migrate reset' is FORBIDDEN on shared databases!"
  echo ""
  echo "   This will drop the entire database and recreate it."
  echo "   Use 'migrate dev' or 'migrate deploy' instead."
  exit 1
fi

# Check 3: Verify we're not dropping shared tables
echo ""
echo "3. Checking migration files for dangerous operations on shared tables..."

DANGEROUS_FOUND=0

# Check for DROP TABLE on athletes
if find prisma/migrations -name "*.sql" -exec grep -l "DROP TABLE.*athletes\|DROP TABLE.*Athlete" {} \; 2>/dev/null | grep -q .; then
  echo "   ❌ Found DROP TABLE on athletes table!"
  echo "   This is a SHARED table - dropping it will affect all projects!"
  DANGEROUS_FOUND=1
fi

# Check for TRUNCATE on athletes
if find prisma/migrations -name "*.sql" -exec grep -l "TRUNCATE.*athletes\|TRUNCATE.*Athlete" {} \; 2>/dev/null | grep -q .; then
  echo "   ❌ Found TRUNCATE on athletes table!"
  echo "   This will delete ALL user data across all projects!"
  DANGEROUS_FOUND=1
fi

# Check for DELETE without WHERE on athletes
if find prisma/migrations -name "*.sql" -exec grep -l "DELETE FROM.*athletes\|DELETE FROM.*Athlete" {} \; 2>/dev/null | xargs grep -v "WHERE" 2>/dev/null | grep -q "DELETE FROM"; then
  echo "   ❌ Found DELETE without WHERE clause on athletes table!"
  echo "   This will delete ALL users!"
  DANGEROUS_FOUND=1
fi

if [ $DANGEROUS_FOUND -eq 0 ]; then
  echo "   ✅ No dangerous operations on shared tables detected"
fi

# Check 4: Create backup before any operation
echo ""
echo "4. Creating backup of shared tables..."
node scripts/create-backup.js
if [ $? -eq 0 ]; then
  echo "   ✅ Backup created successfully"
else
  echo "   ⚠️  Backup failed - but continuing..."
fi

echo ""
echo "================================"
if [ $DANGEROUS_FOUND -eq 1 ]; then
  echo "❌ SAFETY CHECK FAILED - Operation blocked"
  echo ""
  echo "Shared database rules:"
  echo "  - Never DROP shared tables (athletes, GoFastCompany, etc.)"
  echo "  - Never TRUNCATE shared tables"
  echo "  - Always use WHERE clauses in DELETE statements"
  echo "  - Use migrations, not 'db push --accept-data-loss'"
  exit 1
else
  echo "✅ Safety check passed - proceed with caution"
  echo ""
  echo "⚠️  Remember: This database is SHARED with other projects"
  echo "   Changes to shared tables (athletes, etc.) affect all projects"
  exit 0
fi


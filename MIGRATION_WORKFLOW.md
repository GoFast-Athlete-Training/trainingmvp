# Safe Migration Workflow

## ⚠️ CRITICAL: Always Follow This Process

### Step 1: Pre-Migration Safety Check

**BEFORE running any migration, always run:**

```bash
chmod +x scripts/pre-migration-safety-check.sh
./scripts/pre-migration-safety-check.sh
```

This will:
- ✅ Count current users (warns if database is empty)
- ✅ Scan for dangerous operations (DELETE, DROP, TRUNCATE)
- ✅ Validate Prisma schema
- ✅ Create automatic backup

### Step 2: Create Migration

```bash
# Make schema changes in prisma/schema.prisma first
npx prisma migrate dev --name descriptive_migration_name --create-only
```

**Review the generated migration file** before applying!

### Step 3: Review Migration SQL

**ALWAYS review the migration file for:**
- ❌ DELETE statements without WHERE clauses
- ❌ DROP TABLE on user data tables
- ❌ TRUNCATE statements
- ❌ Required fields added without defaults
- ❌ CASCADE deletes on parent tables

### Step 4: Test on Staging First

```bash
# Apply to staging database
DATABASE_URL=$STAGING_DATABASE_URL npx prisma migrate deploy
```

### Step 5: Apply to Production

```bash
# Only after staging verification
npx prisma migrate deploy
```

## Automated Safeguards

### 1. GitHub Actions
- ✅ Blocks PRs with dangerous migrations
- ✅ Validates schema on every PR
- ✅ Runs automatically on migration changes

### 2. Pre-Migration Script
- ✅ Creates backups automatically
- ✅ Warns about empty databases
- ✅ Blocks dangerous operations

### 3. Schema Validation
- ✅ Prisma validates schema before migrations
- ✅ TypeScript checks catch type mismatches

## Recovery Procedures

If data is lost:

1. **Check for backups:**
   ```bash
   node scripts/check-tables-direct.js
   ```

2. **Restore from backup:**
   ```sql
   INSERT INTO "athletes" 
   SELECT * FROM "athletes_backup_YYYYMMDDHHMMSS"
   ON CONFLICT (id) DO NOTHING;
   ```

3. **Check database point-in-time recovery** (if available)

## Common Pitfalls to Avoid

### ❌ DON'T:
- Delete data without WHERE clauses
- Drop tables with user data
- Add required fields without defaults
- Use TRUNCATE
- Skip the safety check

### ✅ DO:
- Always run pre-migration safety check
- Review migration SQL before applying
- Test on staging first
- Create backups before migrations
- Use WHERE clauses in all DELETE statements
- Add nullable fields first, then backfill, then make required

## Emergency Contacts

- Database Admin: [Add contact]
- Backup Location: [Add location]


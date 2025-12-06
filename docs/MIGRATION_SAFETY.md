# Migration Safety Guidelines

## ⚠️ CRITICAL: Data Protection Rules

### NEVER Do These in Migrations:

1. **DELETE without WHERE clause** - Always use WHERE with specific conditions
2. **DROP TABLE on user data tables** - Never drop `athletes`, `Athlete`, or any user-related tables
3. **TRUNCATE** - Never truncate tables with user data
4. **CASCADE deletes on parent tables** - Be careful with CASCADE on tables that reference user data
5. **Required fields without defaults** - If adding a required field, provide a default or backfill strategy

### Required Checks Before Migration:

1. **Run safety check script:**
   ```bash
   psql $DATABASE_URL -f scripts/migration-safety-check.sql
   ```

2. **Create backup:**
   ```bash
   psql $DATABASE_URL -f scripts/pre-migration-backup.sql
   ```

3. **Verify table names match:**
   - Check if database has `athletes` (lowercase) or `Athlete` (PascalCase)
   - Ensure Prisma schema `@@map` matches actual table name

### Table Name Mapping Issue

**Problem:** The database table name must match the Prisma schema mapping.

- If database has `Athlete` (PascalCase) → Schema should have NO `@@map` directive
- If database has `athletes` (lowercase) → Schema should have `@@map("athletes")`

**Current Status:** Schema uses `@@map("athletes")` - verify database table name matches.

### Safe Migration Pattern:

```sql
-- ✅ SAFE: Check before delete
DELETE FROM "table" 
WHERE condition 
AND EXISTS (SELECT 1 FROM ...); -- Verify condition

-- ✅ SAFE: Add nullable column first, then backfill, then make required
ALTER TABLE "table" ADD COLUMN "newField" TEXT;
UPDATE "table" SET "newField" = 'default' WHERE "newField" IS NULL;
ALTER TABLE "table" ALTER COLUMN "newField" SET NOT NULL;

-- ❌ UNSAFE: Direct delete without verification
DELETE FROM "table";

-- ❌ UNSAFE: Drop table
DROP TABLE "athletes";
```

### Recovery Procedures:

If data is accidentally deleted:

1. **Check backups:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_name LIKE '%backup%';
   ```

2. **Restore from backup:**
   ```sql
   INSERT INTO "athletes" SELECT * FROM "athletes_backup_YYYYMMDD_HHMMSS";
   ```

3. **Check transaction logs** (if enabled):
   - PostgreSQL WAL logs
   - Database point-in-time recovery

### Emergency Contacts:

- Database Admin: [Add contact]
- Backup Location: [Add location]


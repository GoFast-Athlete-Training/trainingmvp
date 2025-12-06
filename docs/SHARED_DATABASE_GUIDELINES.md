# Shared Database Guidelines

## Overview

**All GoFast projects share the same database** to maintain a unified `Athlete` table. This allows:
- ✅ Single source of truth for user identity
- ✅ Cross-project user recognition
- ✅ Unified athlete profiles

## ⚠️ CRITICAL RULES

### NEVER Do These on Shared Tables

1. **`prisma db push --accept-data-loss`** 
   - ❌ This DROPS and recreates tables
   - ❌ Will wipe all data across ALL projects
   - ✅ Use `prisma migrate dev` instead

2. **`prisma migrate reset`**
   - ❌ Drops entire database
   - ✅ Use `prisma migrate deploy` for production

3. **DROP TABLE on shared tables**
   - ❌ `athletes`, `go_fast_companies` are SHARED
   - ✅ Only drop project-specific tables

4. **TRUNCATE on shared tables**
   - ❌ Will delete all users across all projects
   - ✅ Use WHERE clauses in DELETE statements

### Safe Operations

✅ **Adding new columns** - Safe, doesn't affect existing data
✅ **Adding indexes** - Safe, improves performance
✅ **Adding new tables** - Safe, project-specific
✅ **Migrations with WHERE clauses** - Safe, targeted changes

## Shared Tables

These tables are **SHARED** across all projects:

- `athletes` - User/athlete profiles
- `go_fast_companies` - Company/tenant data

**DO NOT MODIFY** these without coordinating with all projects.

## Project-Specific Tables

These tables are **PROJECT-SPECIFIC** and safe to modify:

- `TrainingPlan`, `TrainingPlanDay`, etc. (trainingmvp)
- `AttendanceRecord`, `EffortRecord` (f3invigorate)
- Project-specific tables in each repo

## Migration Workflow for Shared Database

### Step 1: Safety Check

```bash
./scripts/shared-database-safety.sh
```

This will:
- ✅ Count current users (warns if empty)
- ✅ Block dangerous commands
- ✅ Check for dangerous operations
- ✅ Create backup

### Step 2: Create Migration

```bash
npx prisma migrate dev --name descriptive_name --create-only
```

**Review the migration file** for:
- ❌ DROP TABLE on shared tables
- ❌ TRUNCATE statements
- ❌ DELETE without WHERE

### Step 3: Test on Staging

Always test migrations on staging first when working with shared tables.

### Step 4: Apply Migration

```bash
npx prisma migrate deploy
```

## Recovery Procedures

If shared table structure is corrupted:

1. **Recreate from schema:**
   ```bash
   node scripts/recreate-athletes-table.js
   ```

2. **Check Prisma Dashboard** for backups

3. **Users will need to re-signup** (Firebase accounts are safe)

## Prevention Checklist

Before any migration:

- [ ] Run `shared-database-safety.sh`
- [ ] Verify you're not modifying shared tables
- [ ] Review migration SQL carefully
- [ ] Test on staging first
- [ ] Coordinate with other projects if modifying shared tables

## Current Shared Tables Status

- ✅ `athletes` - Shared across all projects
- ✅ `go_fast_companies` - Shared across all projects
- ⚠️  Structure must match across all project schemas


# Database Isolation Guidelines

## ⚠️ CRITICAL: Never Share Databases Between Projects

### The Problem

**What Happened:**
- `f3invigorate` project used the SAME database as `trainingmvp`
- Running `prisma db push --accept-data-loss` in f3invigorate **wiped out all athlete data**
- Only attendance records remain because f3invigorate only uses attendance tables

**Root Cause:**
Multiple projects pointing to the same `DATABASE_URL` = **DATA DISASTER**

### The Rule

**ONE PROJECT = ONE DATABASE**

Each project MUST have its own isolated database:
- ✅ `trainingmvp` → `trainingmvp_db`
- ✅ `f3invigorate` → `f3invigorate_db`
- ✅ `gofastapp-mvp` → `gofastapp_db`

### Detection Script

**Before running any migrations, always check:**

```bash
./scripts/detect-database-conflicts.sh
```

This will:
- ✅ Check if other projects use the same database
- ✅ Warn about conflicts
- ✅ Block migrations if conflicts detected

### Safe Database Setup

#### Option 1: Separate Databases (Recommended)

```bash
# trainingmvp/.env.local
DATABASE_URL="postgresql://user:pass@host:5432/trainingmvp_db"

# f3invigorate/.env.local  
DATABASE_URL="postgresql://user:pass@host:5432/f3invigorate_db"
```

#### Option 2: Schema Isolation (Advanced)

If you MUST share a database, use PostgreSQL schemas:

```prisma
// trainingmvp schema
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["training"]
}

// f3invigorate schema
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["f3"]
}
```

### Migration Safety

**NEVER run these commands without checking database first:**

```bash
# ❌ DANGEROUS - Can wipe data
prisma db push --accept-data-loss
prisma migrate reset

# ✅ SAFE - Check first
./scripts/detect-database-conflicts.sh
./scripts/pre-migration-safety-check.sh
npx prisma migrate dev
```

### Recovery from Cross-Project Wipes

If data was lost due to cross-project conflict:

1. **Check Prisma Data Platform backups:**
   - Go to Prisma Dashboard
   - Check backup snapshots
   - Restore to before the conflict

2. **Check for backup tables:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_name LIKE '%backup%';
   ```

3. **Contact Prisma Support:**
   - They may have point-in-time recovery
   - Can restore to specific timestamp

### Prevention Checklist

Before starting a new project:

- [ ] Create separate database
- [ ] Verify DATABASE_URL is unique
- [ ] Run conflict detection script
- [ ] Document database in project README
- [ ] Add database name to .env.example
- [ ] Never use `--accept-data-loss` flag

### Current Status

**Affected Projects:**
- ❌ `trainingmvp` - Data lost (athletes table wiped)
- ❌ `f3invigorate` - Used same database, caused the wipe

**Action Required:**
1. Create separate database for f3invigorate
2. Restore trainingmvp data from backup
3. Update both projects' DATABASE_URL
4. Run conflict detection to verify


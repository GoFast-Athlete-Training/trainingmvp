# Database Recovery Checklist

## Immediate Actions

### 1. Verify Current State
```bash
# Run database verification
psql $DATABASE_URL -f scripts/verify-database-state.sql
```

### 2. Check for Backups
```bash
# List all backup tables
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%backup%';"
```

### 3. Check GitHub Security Log
1. Go to: https://github.com/settings/security-log
2. Filter by:
   - Time: Last 24 hours
   - Action: repository, oauth_access
3. Look for:
   - Unauthorized repository access
   - Token usage
   - Unusual commit activity

### 4. Revoke Exposed Token
1. Go to: https://github.com/settings/tokens
2. Find and revoke the exposed token (check conversation history if needed)
3. Click "Revoke"

## Recovery Steps (if data is missing)

### Option 1: Restore from Backup Table
```sql
-- Find the most recent backup
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'athletes_backup_%'
ORDER BY table_name DESC 
LIMIT 1;

-- Restore (replace YYYYMMDD_HHMMSS with actual backup name)
INSERT INTO "athletes" 
SELECT * FROM "athletes_backup_YYYYMMDD_HHMMSS"
ON CONFLICT (id) DO NOTHING;
```

### Option 2: Check Database Point-in-Time Recovery
If your database provider supports PITR:
- Check backup snapshots
- Restore to time before migration
- Export data from restored snapshot

### Option 3: Check Application Logs
- Check Vercel/deployment logs for errors
- Check database connection logs
- Look for migration errors

## Prevention for Future

1. ✅ Always run `pre-migration-backup.sql` before migrations
2. ✅ Use `migration-safety-check.sql` to verify state
3. ✅ Test migrations on staging first
4. ✅ Use GitHub Actions to block dangerous migrations
5. ✅ Never commit tokens or secrets

## Contact Points

- Database Admin: [Add contact]
- GitHub Admin: [Add contact]
- Backup Location: [Add location]


#!/bin/bash
# Security Audit Script - Check for unauthorized access

echo "🔒 Security Audit - Checking for unauthorized access"
echo "=================================================="
echo ""

# Check GitHub API for recent activity with the token
echo "1. Checking GitHub API for recent activity..."
echo "   (Note: This requires a valid token to check audit logs)"
echo ""

# Check for recent git activity
echo "2. Checking recent git commits..."
git log --all --since="24 hours ago" --pretty=format:"%h - %an (%ae) : %s" | head -20
echo ""

# Check for recent file changes
echo "3. Checking for suspicious file modifications..."
git diff --name-only HEAD~10 HEAD | grep -E "(\.env|config|secret|token|key)" || echo "   No sensitive files modified"
echo ""

# Check database connection logs (if available)
echo "4. Database connection check..."
echo "   Run this query on your database:"
echo "   SELECT usename, application_name, client_addr, state, query_start"
echo "   FROM pg_stat_activity"
echo "   WHERE datname = current_database()"
echo "   ORDER BY query_start DESC;"
echo ""

# Check for environment variable leaks
echo "5. Checking for exposed tokens in code..."
if grep -r "ghp_" . --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null; then
  echo "   ⚠️  WARNING: Found potential token in code!"
else
  echo "   ✅ No tokens found in code"
fi
echo ""

echo "=================================================="
echo "✅ Security audit complete"
echo ""
echo "Next steps:"
echo "1. Revoke the exposed token on GitHub"
echo "2. Check GitHub audit log: https://github.com/settings/security-log"
echo "3. Review recent repository activity"
echo "4. Check database access logs"


#!/bin/bash
# Safe database push wrapper - BLOCKS --accept-data-loss

echo "🛡️  Safe Database Push"
echo "======================"
echo ""

# Check for --accept-data-loss flag
if echo "$*" | grep -q "accept-data-loss\|--accept-data-loss"; then
  echo "❌ ERROR: '--accept-data-loss' flag is FORBIDDEN!"
  echo ""
  echo "This flag will DROP and recreate tables, wiping all data."
  echo "Since this database is SHARED with other projects, this is DANGEROUS."
  echo ""
  echo "✅ SAFE ALTERNATIVES:"
  echo "  - Use 'npx prisma migrate dev' to create migrations"
  echo "  - Review migration SQL before applying"
  echo "  - Use 'npx prisma migrate deploy' for production"
  echo ""
  exit 1
fi

# Run the command without the dangerous flag
echo "✅ Running safe database push..."
npx prisma db push "$@"


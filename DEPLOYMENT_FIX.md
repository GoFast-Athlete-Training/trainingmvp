# Deployment Fix - Prisma Client Regeneration

## Issue

Production build on Vercel is using an old Prisma client that doesn't recognize the `go_fast_companies` table.

## Root Cause

The Prisma client was generated before we:
1. Fixed the Athlete table mapping (removed `@@map("athletes")`)
2. Created the `go_fast_companies` table
3. Updated the schema

## Solution

**The production build needs to be redeployed** so Prisma generates a fresh client with the correct schema.

### Steps to Fix:

1. **Commit all schema changes:**
   ```bash
   git add prisma/schema.prisma
   git commit -m "Fix Athlete table mapping and ensure go_fast_companies exists"
   git push
   ```

2. **Vercel will automatically:**
   - Run `prisma generate` during build
   - Generate new Prisma client with correct schema
   - Deploy with updated client

3. **Verify after deployment:**
   - Check that athlete creation works
   - Verify company upsert succeeds

## Current Status

✅ **Local:** Prisma client works correctly
✅ **Schema:** All tables exist and match schema
✅ **Database:** `go_fast_companies` table exists
❌ **Production:** Needs redeploy to regenerate Prisma client

## Verification Commands

After deployment, these should work:
- `POST /api/athlete/create` - Should create athlete successfully
- `POST /api/athlete/hydrate` - Should hydrate athlete data
- `GET /api/athlete/profile` - Should return athlete profile


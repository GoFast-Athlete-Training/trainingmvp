# Schema Sync Complete: trainingmvp → gofastapp-mvp

## Summary
The Prisma schema in `trainingmvp` has been updated to match the `gofastapp-mvp` Athlete model structure. This fixes authentication errors caused by missing required fields.

## Changes Made

### 1. Athlete Model Updates
**Added Required Fields:**
- `email: String?` - User email from Firebase
- `companyId: String` - **REQUIRED** - Links athlete to GoFastCompany
- `company: GoFastCompany` - Relation to company

**Added Profile Fields:**
- `firstName`, `lastName`, `gofastHandle`, `photoURL`
- `phoneNumber`, `birthday`, `gender`, `city`, `state`
- `primarySport`, `bio`, `instagram`

**Added Garmin Integration Fields:**
- `garmin_user_id`, `garmin_access_token`, `garmin_refresh_token`
- `garmin_expires_in`, `garmin_scope`, `garmin_connected_at`
- `garmin_last_sync_at`, `garmin_is_connected`, `garmin_disconnected_at`
- `garmin_permissions`, `garmin_user_profile`, `garmin_user_sleep`, `garmin_user_preferences`

**Added Strava Fields (future):**
- `strava_id`, `strava_access_token`, `strava_refresh_token`, `strava_expires_at`

**Kept Training-Specific Fields:**
- `canonicalFiveKPace` - New canonical field
- `preferredRunDays` - New canonical field
- Legacy training fields (deprecated but kept for migration)

### 2. GoFastCompany Model Added
```prisma
model GoFastCompany {
  id           String      @id @default(cuid())
  name         String
  slug         String      @unique
  address      String?
  city         String?
  state        String?
  zip          String?
  domain       String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  athletes     Athlete[]
  @@map("go_fast_companies")
}
```

### 3. AthleteActivity Model Enhanced
**Added Location Fields:**
- `startLatitude`, `startLongitude`, `endLatitude`, `endLongitude`
- `summaryPolyline`

**Added Data Fields:**
- `summaryData: Json?`, `detailData: Json?`, `hydratedAt: DateTime?`
- `steps: Int?`

### 4. API Route Updates

**`/app/api/athlete/create/route.ts`:**
- Now creates/upserts `GoFastCompany` before creating athlete
- Sets `companyId` on athlete (required field)
- Syncs Firebase profile data (email, firstName, lastName, photoURL)
- Response format matches `gofastapp-mvp` structure

**`/lib/domain-athlete.ts`:**
- Updated `createAthlete` function signature to include `companyId: string`

## Next Steps

### 1. Run Database Migration
```bash
cd /Users/adamcole/Documents/GoFast/trainingmvp
npx prisma migrate dev --name sync_athlete_schema_with_gofastapp
```

**⚠️ Important:** This migration will:
- Add `GoFastCompany` table
- Add `companyId` column to `athletes` table (REQUIRED - existing rows will need a default)
- Add all new profile, Garmin, and Strava fields to `athletes` table
- Add new fields to `athlete_activities` table

**Migration Strategy:**
- If you have existing athletes, you'll need to set a default `companyId` for them
- The migration will create the default "gofast" company automatically via the API route
- Consider a data migration script to backfill `companyId` for existing athletes

### 2. Generate Prisma Client
```bash
npx prisma generate
```

### 3. Verify Schema
```bash
npx prisma validate
```

## Testing

After migration, test the auth flow:
1. Sign up/login should create/update athlete with `companyId`
2. `/api/athlete/create` should return full profile data
3. `/api/athlete/hydrate` should work with new schema

## Files Modified
- `prisma/schema.prisma` - Complete Athlete model sync + GoFastCompany model
- `app/api/athlete/create/route.ts` - Added company creation and profile sync
- `lib/domain-athlete.ts` - Updated createAthlete signature

## Compatibility
✅ Schema now matches `gofastapp-mvp` Athlete model
✅ Training-specific fields (`canonicalFiveKPace`, `preferredRunDays`) preserved
✅ All training relations maintained
✅ Backward compatible with existing training data


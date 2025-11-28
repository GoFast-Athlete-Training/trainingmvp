# Firebase Auth Setup Complete ✅

## What Was Done

### 1. **Added Firebase Dependencies**
- Added `firebase` and `firebase-admin` to `package.json`
- Added `axios` for API client

### 2. **Created Lib Files (Mirroring gofastapp-mvp)**
- ✅ `lib/firebase.ts` - Firebase client initialization
- ✅ `lib/firebaseAdmin.ts` - Server-side Firebase admin
- ✅ `lib/auth.ts` - Client-side auth helpers (signInWithGoogle, getToken)
- ✅ `lib/localstorage.ts` - LocalStorage API for athlete data
- ✅ `lib/domain-athlete.ts` - Athlete domain functions
- ✅ `lib/api.ts` - API client with automatic token injection
- ✅ `lib/api-helpers.ts` - Server-side helper to get athleteId from token
- ✅ Updated `lib/prisma.ts` - Using Proxy pattern for better singleton handling

### 3. **Created API Routes**
- ✅ `/api/athlete/hydrate` - Hydrate athlete data for localStorage
- ✅ `/api/athlete/create` - Create new athlete on signup

### 4. **Updated All API Routes to Use Token Verification**
- ✅ `/api/training/hub` - Now uses `getAthleteIdFromRequest()`
- ✅ `/api/training/plan` - Now uses token verification
- ✅ `/api/training/plan/[weekIndex]` - Now uses token verification
- ✅ `/api/training/day/[dayId]` - Now uses token verification
- ✅ `/api/training/match/[dayId]` - Now uses token verification (GET & POST)

**Removed:** All `TEST_ATHLETE_ID` fallbacks and query param usage

### 5. **Updated Client Pages**
- ✅ `app/page.tsx` - Checks Firebase auth state before routing
- ✅ `app/signup/page.tsx` - Implements actual Firebase Google sign-in, creates athlete if needed
- ✅ `app/training/page.tsx` - Uses localStorage athleteId, hydrates if needed
- ✅ `app/training/plan/page.tsx` - Uses API client instead of fetch
- ✅ `app/training/plan/[weekIndex]/page.tsx` - Uses API client
- ✅ `app/training/day/[dayId]/page.tsx` - Uses API client
- ✅ `app/training/match/[dayId]/page.tsx` - Uses API client

## Environment Variables Required

### Firebase Client (Public)
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

### Firebase Admin (Server-side)
```bash
FIREBASE_SERVICE_ACCOUNT=  # JSON string of service account
```

### Database
```bash
DATABASE_URL=  # PostgreSQL connection string
```

### Existing
```bash
OPENAI_API_KEY=  # For training plan generation
```

### ❌ REMOVE THIS:
```bash
# NEXT_PUBLIC_TEST_ATHLETE_ID=  # DELETE - No longer needed
```

## How It Works Now

### Authentication Flow
1. User visits `/` (splash) → checks Firebase auth
2. If not authenticated → routes to `/signup`
3. User signs in with Google → Firebase auth
4. App checks if athlete exists in database
5. If not, creates athlete via `/api/athlete/create`
6. Hydrates athlete data via `/api/athlete/hydrate`
7. Stores athlete in localStorage
8. Routes to `/training`

### API Request Flow
1. Client makes request using `api.get()` or `api.post()`
2. `lib/api.ts` interceptor adds Firebase token to `Authorization` header
3. Server-side route calls `getAthleteIdFromRequest(request)`
4. Helper verifies Firebase token
5. Gets athleteId from database (by firebaseId)
6. Returns athleteId for use in Prisma queries

### Data Persistence
- Athlete data stored in localStorage after hydration
- Hydration timestamp tracked (refreshes every 5 minutes)
- All API calls automatically include auth token
- No more passing athleteId as query params

## Next Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Environment Variables**
   - Add all Firebase config vars
   - Add `FIREBASE_SERVICE_ACCOUNT` (JSON string)
   - Ensure `DATABASE_URL` is set

3. **Test Authentication**
   - Visit the app
   - Should redirect to signup if not authenticated
   - Sign in with Google
   - Should create athlete and route to training hub

4. **Verify Prisma Works**
   - Once authenticated, Prisma queries should work
   - No more `DATABASE_URL` errors (assuming env var is set)
   - All API routes should return data for authenticated user

## Notes

- All `TEST_ATHLETE_ID` references removed
- All API routes now secure (require valid Firebase token)
- Client pages handle 401 errors and redirect to signup
- Architecture now matches `gofastapp-mvp` pattern


# TrainingMVP Architecture Document

## Current State Analysis

### Overview
The `trainingmvp` repository is a self-contained Next.js 14 training module that provides a complete training plan management system. However, it currently lacks proper authentication and uses a test athlete ID approach.

### Current Architecture

#### 1. **Authentication Status: ❌ NOT IMPLEMENTED**

**Current Implementation:**
- Uses `NEXT_PUBLIC_TEST_ATHLETE_ID` environment variable
- No Firebase authentication
- No user session management
- Direct routing to `/training` without auth checks
- Signup page exists but doesn't actually authenticate (just routes to training)

**Code Locations:**
- `app/page.tsx` - Splash screen, routes directly to `/training` (line 22)
- `app/signup/page.tsx` - Placeholder signup (lines 20-30, TODO comments)
- `app/training/page.tsx` - Uses `TEST_ATHLETE_ID` constant (line 10)
- `app/api/training/hub/route.ts` - Falls back to `TEST_ATHLETE_ID` (line 10)

**Issues:**
- No way to identify the actual logged-in user
- No athleteId resolution from Firebase user
- No localStorage persistence
- All API routes accept `athleteId` as query param but default to test ID

#### 2. **Local Storage: ❌ NOT IMPLEMENTED**

**Current State:**
- No localStorage usage
- No athlete data persistence
- No hydration mechanism
- No way to cache athlete data between sessions

**Comparison with gofastapp-mvp:**
- `gofastapp-mvp` has `lib/localstorage.ts` with `LocalStorageAPI`
- Stores: athlete, crews, primaryCrew, hydrationTimestamp
- Used throughout the app for quick access to athlete data

#### 3. **Lib Structure: ⚠️ INCOMPLETE**

**Current Structure:**
```
lib/
  prisma.ts              ✅ Basic Prisma client
  services/
    analysis.ts          ✅ GoFastScore computation
    extraction.ts        ✅ OpenAI extraction
    match-logic.ts        ✅ Garmin matching
    plan-generator.ts    ✅ AI plan generation
  utils/
    dates.ts             ✅ Date utilities
    pace.ts              ✅ Pace calculations
```

**Missing from gofastapp-mvp pattern:**
- ❌ `lib/auth.ts` - Firebase auth helpers
- ❌ `lib/firebase.ts` - Firebase client initialization
- ❌ `lib/firebaseAdmin.ts` - Firebase admin (server-side)
- ❌ `lib/localstorage.ts` - LocalStorage API
- ❌ `lib/domain-athlete.ts` - Athlete domain functions
- ❌ `lib/api.ts` - API client helpers

#### 4. **API Route Pattern: ⚠️ INCONSISTENT**

**Current Pattern:**
```typescript
// app/api/training/hub/route.ts
const TEST_ATHLETE_ID = process.env.NEXT_PUBLIC_TEST_ATHLETE_ID || 'test-athlete-id';
const athleteId = searchParams.get('athleteId') || TEST_ATHLETE_ID;
```

**Issues:**
- No auth token verification
- No server-side athlete resolution from Firebase token
- Relies on client passing athleteId (insecure)
- Falls back to test ID (development only)

**Should be:**
```typescript
// Get Firebase token from request headers
// Verify token server-side
// Resolve athleteId from Firebase user
// Use athleteId for queries
```

#### 5. **Page Components: ⚠️ NO AUTH CHECKS**

**Current Flow:**
1. `app/page.tsx` (splash) → routes to `/training` after 1.5s
2. `app/training/page.tsx` → fetches with `TEST_ATHLETE_ID`
3. No auth guards
4. No redirect to signup if not authenticated

**Should be:**
1. Check Firebase auth state
2. If authenticated → get athlete from localStorage or hydrate
3. If not authenticated → redirect to signup
4. Use actual athleteId from authenticated user

## Architecture Comparison: trainingmvp vs gofastapp-mvp

### gofastapp-mvp Architecture (Target)

#### Lib Structure
```
lib/
  auth.ts              - Client-side Firebase auth (signInWithGoogle, getToken)
  firebase.ts          - Firebase client initialization
  firebaseAdmin.ts     - Firebase admin (server-side token verification)
  localstorage.ts      - LocalStorage API (setAthlete, getAthlete, etc.)
  domain-athlete.ts    - Athlete domain functions (getAthleteById, hydrateAthlete)
  prisma.ts            - Prisma client with proper singleton pattern
  api.ts               - API client helpers
```

#### Auth Flow
1. User signs in with Google → Firebase auth
2. Get Firebase user → resolve athleteId from database (by firebaseId)
3. Hydrate athlete data → store in localStorage
4. Use athleteId for all API calls
5. Server-side: verify Firebase token → get athleteId

#### API Route Pattern
```typescript
// Server-side
import { verifyFirebaseIdToken } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const decoded = await verifyFirebaseIdToken(token);
  const athlete = await getAthleteByFirebaseId(decoded.uid);
  const athleteId = athlete.id;
  // Use athleteId...
}
```

#### Client-Side Pattern
```typescript
// Client-side
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import { onAuthStateChanged } from 'firebase/auth';

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Get athleteId from localStorage or hydrate
      const athlete = LocalStorageAPI.getAthlete();
      if (!athlete) {
        // Hydrate athlete data
        const response = await fetch('/api/athlete/hydrate');
        const data = await response.json();
        LocalStorageAPI.setAthlete(data.athlete);
      }
    } else {
      router.push('/signup');
    }
  });
  return () => unsubscribe();
}, []);
```

## Required Changes to Mirror gofastapp-mvp

### Phase 1: Add Missing Lib Files

1. **Create `lib/firebase.ts`**
   - Initialize Firebase client
   - Export auth instance

2. **Create `lib/firebaseAdmin.ts`**
   - Initialize Firebase admin
   - Token verification function

3. **Create `lib/auth.ts`**
   - `signInWithGoogle()`
   - `getToken()`
   - Client-side auth helpers

4. **Create `lib/localstorage.ts`**
   - `LocalStorageAPI.setAthlete()`
   - `LocalStorageAPI.getAthlete()`
   - Mirror gofastapp-mvp pattern

5. **Create `lib/domain-athlete.ts`**
   - `getAthleteById()`
   - `getAthleteByFirebaseId()`
   - `hydrateAthlete()` (if needed)
   - `createAthlete()` (for signup)

6. **Update `lib/prisma.ts`**
   - Use gofastapp-mvp's Proxy pattern for better singleton handling

### Phase 2: Update Authentication Flow

1. **Update `app/page.tsx`**
   - Check Firebase auth state
   - Route to `/training` if authenticated
   - Route to `/signup` if not

2. **Update `app/signup/page.tsx`**
   - Implement actual Firebase Google sign-in
   - Create athlete record if doesn't exist
   - Store athlete in localStorage
   - Route to `/training`

3. **Update `app/training/page.tsx`**
   - Get athleteId from localStorage
   - Redirect to signup if no athlete
   - Remove `TEST_ATHLETE_ID` usage

4. **Add auth middleware/guard**
   - Protect `/training/*` routes
   - Check auth state before rendering

### Phase 3: Update API Routes

1. **Create auth helper for API routes**
   ```typescript
   // lib/api-helpers.ts
   export async function getAthleteIdFromRequest(request: NextRequest) {
     const token = request.headers.get('authorization')?.replace('Bearer ', '');
     if (!token) throw new Error('No auth token');
     const decoded = await verifyFirebaseIdToken(token);
     const athlete = await getAthleteByFirebaseId(decoded.uid);
     return athlete.id;
   }
   ```

2. **Update all API routes**
   - Remove `athleteId` query param
   - Use `getAthleteIdFromRequest()` instead
   - Remove `TEST_ATHLETE_ID` fallback

### Phase 4: Add Hydration API

1. **Create `/api/athlete/hydrate` route**
   - Verify Firebase token
   - Get athlete by firebaseId
   - Return athlete data for localStorage

2. **Update client to hydrate on mount**
   - Check localStorage for athlete
   - If missing, call hydrate API
   - Store in localStorage

## Database Schema Notes

The Prisma schema in trainingmvp already has:
- `Athlete` model with `firebaseId` field (line 15)
- Proper relations to training plans, activities, etc.

**This is good!** The schema is ready for Firebase auth integration.

## Environment Variables Needed

```bash
# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Firebase Admin (Server-side)
FIREBASE_SERVICE_ACCOUNT=  # JSON string

# Database
DATABASE_URL=

# OpenAI (existing)
OPENAI_API_KEY=

# Remove this:
# NEXT_PUBLIC_TEST_ATHLETE_ID=  # DELETE THIS
```

## Summary

### Current State
- ✅ Training features work (hub, plan, day, match)
- ✅ Database schema is correct
- ✅ Services are well-structured
- ❌ No authentication
- ❌ No localStorage
- ❌ No athlete resolution from Firebase
- ❌ Insecure API routes (accept athleteId from client)

### Target State (mirror gofastapp-mvp)
- ✅ Firebase auth (client + admin)
- ✅ LocalStorage for athlete data
- ✅ Server-side token verification
- ✅ Secure API routes (athleteId from token)
- ✅ Proper auth flow (signup → hydrate → training)
- ✅ Auth guards on protected routes

### Priority Actions
1. **HIGH**: Add Firebase auth lib files
2. **HIGH**: Update signup to actually authenticate
3. **HIGH**: Add localStorage API
4. **MEDIUM**: Update API routes to use token verification
5. **MEDIUM**: Add auth guards to pages
6. **LOW**: Remove all `TEST_ATHLETE_ID` references


# Athlete Lifecycle Analysis: GoFast MVP vs TrainingMVP

## 🔍 GoFast MVP - Working Implementation

### 1. Athlete Creation (API Route + Function + Prisma Call)

**Route:** `POST /api/athlete/create`  
**File:** `gofastapp-mvp/app/api/athlete/create/route.ts`

**Flow:**
1. Extract Firebase token from `Authorization: Bearer <token>` header
2. Verify token using `adminAuth.verifyIdToken(token)`
3. Extract `firebaseId = decodedToken.uid`
4. Extract optional fields: `email`, `displayName`, `picture` from decoded token
5. Parse `displayName` into `firstName` and `lastName`
6. **Ensure GoFastCompany exists** via `prisma.goFastCompany.upsert({ where: { slug: "gofast" } })`
7. **Upsert Athlete** using `prisma.athlete.upsert({ where: { firebaseId } })`

**Exact Prisma Command:**
```typescript
const athlete = await prisma.athlete.upsert({
  where: { firebaseId },
  update: {
    email: email || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    photoURL: picture || undefined,
    companyId: gofastCompany.id,
  },
  create: {
    firebaseId,
    email: email || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    photoURL: picture || undefined,
    companyId: gofastCompany.id, // REQUIRED
  },
});
```

### 2. Firebase UID Usage

- **Primary Key:** `firebaseId` is used as the `where` clause in `upsert`
- **Unique Constraint:** `firebaseId String @unique` in Prisma schema
- **Token Source:** Extracted from `decodedToken.uid` after `adminAuth.verifyIdToken()`

### 3. Required Fields for Successful Save

**Minimum Required:**
- `firebaseId` (String, unique, required)
- `companyId` (String, required - foreign key to GoFastCompany)

**Optional but Synced:**
- `email` (from `decodedToken.email`)
- `firstName` (parsed from `decodedToken.name`)
- `lastName` (parsed from `decodedToken.name`)
- `photoURL` (from `decodedToken.picture`)

### 4. Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Firebase service account email
- `FIREBASE_PRIVATE_KEY` - Firebase service account private key

**Firebase Admin Initialization:**
- Uses individual env vars (not JSON string)
- Throws error if missing (not graceful failure)
- Initializes once, reuses instance

### 5. Hydration Endpoint

**Route:** `POST /api/athlete/hydrate`  
**File:** `gofastapp-mvp/app/api/athlete/hydrate/route.ts`

**Expects:**
- `Authorization: Bearer <token>` header
- No body required

**Returns:**
```json
{
  "success": true,
  "message": "Athlete hydrated successfully",
  "athlete": {
    "athleteId": "...",
    "id": "...",
    "firebaseId": "...",
    "email": "...",
    "firstName": "...",
    "lastName": "...",
    "runCrews": [...],
    "weeklyActivities": [...],
    "weeklyTotals": {...}
  },
  "timestamp": "..."
}
```

**Hydration Function:** `lib/domain-athlete.ts::hydrateAthlete()`
- Uses `prisma.athlete.findUnique({ where: { id: athleteId }, include: { ... } })`
- Includes: `runCrewMemberships`, `runCrewManagers`, `activities` (last 7 days)
- Calculates `weeklyTotals` from activities
- Formats response with computed fields

### 6. Middleware & Utils

**Firebase Admin:**
- **File:** `lib/firebaseAdmin.ts`
- **Export:** `adminAuth` (Proxy that lazy-loads)
- **Function:** `getAdminAuth()` - initializes and returns `admin.auth.Auth`
- **Initialization:** Uses `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- **Error Handling:** Throws error if env vars missing (not graceful)

**Prisma Client:**
- **File:** `lib/prisma.ts`
- **Export:** `prisma` (Proxy that lazy-loads)
- **Pattern:** Uses global singleton to prevent multiple instances
- **Lazy Loading:** Only creates client when first accessed

**No Custom Middleware:**
- Auth verification happens inline in each route
- No `verifyAuth` wrapper function
- Token extraction and verification is explicit in each route

### 7. Database Table Name

**Prisma Schema:**
- Model: `Athlete`
- **No `@@map` directive** - uses default Prisma naming
- **Actual table name:** `Athlete` (PascalCase, Prisma default)

**Note:** GoFast MVP does NOT use `@@map("athletes")` - it uses Prisma's default naming convention.

---

## ❌ TrainingMVP - Current Broken Implementation

### 1. Athlete Creation

**Route:** `POST /api/athlete/create`  
**File:** `trainingmvp/app/api/athlete/create/route.ts`

**Differences:**
- ✅ Same structure (upsert pattern)
- ✅ Same Firebase token verification
- ✅ Same company upsert
- ⚠️ **Uses `getAdminAuth()` instead of `adminAuth`** (different import pattern)
- ⚠️ **Null check on `getAdminAuth()`** - returns 500 if null (graceful failure vs throw)

### 2. Firebase Admin Implementation

**File:** `trainingmvp/lib/firebaseAdmin.ts`

**Key Differences:**
- ❌ **Uses `FIREBASE_SERVICE_ACCOUNT` (JSON string)** instead of individual env vars
- ❌ **Graceful failure** - returns `null` if not initialized (vs throwing error)
- ❌ **Different initialization pattern** - uses `safeGetServiceAccount()` helper
- ⚠️ **Warning log** instead of error when service account missing

**Problem:** If `FIREBASE_SERVICE_ACCOUNT` is not set, `getAdminAuth()` returns `null`, causing 500 errors instead of clear error messages.

### 3. Hydration Endpoint

**Route:** `POST /api/athlete/hydrate`  
**File:** `trainingmvp/app/api/athlete/hydrate/route.ts`

**Current Implementation:**
- ✅ Same token verification pattern
- ✅ Same `getAthleteByFirebaseId()` lookup
- ❌ **Different hydration function** - includes `trainingPlans` instead of `runCrewMemberships`
- ❌ **Simplified return** - only returns basic athlete fields + `trainingPlanId`
- ❌ **Missing computed fields** - no `fullName`, `profileComplete`, etc.

**Hydration Function:** `lib/domain-athlete.ts::hydrateAthlete()`
- Includes: `activities`, `trainingPlans` (with `raceRegistry`, `trainingPlanFiveKPace`)
- **Does NOT include:** `runCrewMemberships`, `runCrewManagers`
- Returns simplified structure

### 4. Database Table Name

**Prisma Schema:**
- Model: `Athlete`
- **Uses `@@map("athletes")`** - maps to lowercase `athletes` table
- **Actual table name:** `athletes` (lowercase, explicit mapping)

**Difference:** GoFast MVP uses `Athlete` (default), TrainingMVP uses `athletes` (mapped).

---

## 📋 Correct Athlete Lifecycle (GoFast MVP Pattern)

### Creation Flow:
1. **Client:** Firebase auth → get ID token
2. **Client:** POST `/api/athlete/create` with `Authorization: Bearer <token>`
3. **Server:** Extract token from header
4. **Server:** `adminAuth.verifyIdToken(token)` → get `firebaseId`
5. **Server:** `prisma.goFastCompany.upsert({ where: { slug: "gofast" } })` → ensure company exists
6. **Server:** `prisma.athlete.upsert({ where: { firebaseId }, ... })` → create/update athlete
7. **Server:** Return `{ success: true, athleteId: "...", data: {...} }`

### Hydration Flow:
1. **Client:** POST `/api/athlete/hydrate` with `Authorization: Bearer <token>`
2. **Server:** Extract token → verify → get `firebaseId`
3. **Server:** `getAthleteByFirebaseId(firebaseId)` → find athlete
4. **Server:** `hydrateAthlete(athleteId)` → load with relations
5. **Server:** Return `{ success: true, athlete: {...} }`
6. **Client:** Store in localStorage via `LocalStorageAPI.setAthlete()`

### Required Fields:
- `firebaseId` (unique, required)
- `companyId` (required, foreign key)

### Environment Variables:
- `DATABASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

---

## 🔴 TrainingMVP Divergences & Misconnections

### 1. Firebase Admin Configuration
- **GoFast MVP:** Uses individual env vars (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
- **TrainingMVP:** Uses `FIREBASE_SERVICE_ACCOUNT` (JSON string)
- **Impact:** Different env var setup, TrainingMVP's pattern is less clear when missing

### 2. Firebase Admin Error Handling
- **GoFast MVP:** Throws error if env vars missing (fails fast, clear error)
- **TrainingMVP:** Returns `null` if not initialized (graceful failure, but causes 500s downstream)
- **Impact:** TrainingMVP shows generic 500 errors instead of clear "Firebase Admin not configured" messages

### 3. Hydration Response Structure
- **GoFast MVP:** Returns full athlete object with `runCrews`, `weeklyActivities`, `weeklyTotals`, computed fields
- **TrainingMVP:** Returns simplified object with only `trainingPlans` and basic fields
- **Impact:** Frontend expects different structure, may cause hydration failures

### 4. Database Table Naming
- **GoFast MVP:** Uses Prisma default (`Athlete` table)
- **TrainingMVP:** Uses explicit mapping (`athletes` table)
- **Impact:** Different table names, but both work if schema matches

### 5. Prisma Client Pattern
- **Both:** Use Proxy pattern for lazy loading ✅
- **Both:** Use global singleton ✅
- **No divergence** - both implementations are correct

### 6. Auth Verification Pattern
- **Both:** Inline token verification in each route ✅
- **Both:** Extract from `Authorization: Bearer <token>` header ✅
- **No divergence** - both implementations are correct

---

## ✅ Recommendations to Match GoFast MVP

1. **Change Firebase Admin to use individual env vars:**
   - Remove `FIREBASE_SERVICE_ACCOUNT` support
   - Use `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
   - Throw error if missing (fail fast)

2. **Update hydration to match GoFast MVP structure:**
   - Include all athlete fields
   - Add computed fields (`fullName`, `profileComplete`, etc.)
   - Return consistent structure

3. **Keep database table mapping:**
   - TrainingMVP's `@@map("athletes")` is fine
   - Just ensure schema matches actual database

4. **Match error handling:**
   - Throw errors instead of returning null
   - Provide clear error messages

---

## 📊 Summary Table

| Aspect | GoFast MVP | TrainingMVP | Status |
|--------|-----------|-------------|--------|
| **Prisma Upsert** | `prisma.athlete.upsert({ where: { firebaseId } })` | ✅ Same | ✅ Match |
| **Required Fields** | `firebaseId`, `companyId` | ✅ Same | ✅ Match |
| **Firebase Admin Env** | Individual vars | JSON string | ❌ Divergence |
| **Firebase Admin Error** | Throws error | Returns null | ❌ Divergence |
| **Hydration Structure** | Full object + computed | Simplified | ❌ Divergence |
| **Table Name** | `Athlete` (default) | `athletes` (mapped) | ⚠️ Different but OK |
| **Prisma Client** | Proxy lazy-load | Proxy lazy-load | ✅ Match |
| **Token Verification** | Inline in route | Inline in route | ✅ Match |


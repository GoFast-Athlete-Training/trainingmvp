# ActivityId Outlook: How Activities Link to Training Days

## Overview

`activityId` is the **optional link** between `AthleteActivity` (Garmin sync) and `TrainingDayExecuted` (completed workout). This document explains the complete flow from Garmin webhook → Activity creation → Auto-match → Manual linking.

---

## Data Model Structure

### `AthleteActivity` (Source of Truth for Garmin Data)

**Table:** `athlete_activities`

**Purpose:** Raw activity data synced from Garmin (or other sources)

**Key Fields:**
- `id` (String, cuid) - **Primary key** - This is what `activityId` references
- `athleteId` (String) - FK to `Athlete`
- `sourceActivityId` (String, unique) - **Garmin's external ID** (e.g., "123456789")
- `source` (String, default: "garmin")
- `startTime` (DateTime?) - When activity started
- `activityType` (String?) - "running", "cycling", etc.
- `distance` (Float?) - meters
- `duration` (Int?) - seconds
- `summaryData` (Json?) - Raw webhook payload
- `detailData` (Json?) - Detailed data (laps, splits, HR zones)

**Relations:**
- `athlete` → `Athlete` (many-to-one)

**Critical Notes:**
- Created via Garmin webhook (`POST /api/garmin/webhook`)
- `sourceActivityId` is unique - prevents duplicate Garmin activities
- One athlete can have many activities
- Activities exist independently of training plans

---

### `TrainingDayExecuted` (Completed Workout Record)

**Table:** `training_days_executed`

**Purpose:** Records when an athlete completes a planned workout

**Key Fields:**
- `id` (String, cuid)
- `athleteId` (String) - FK to `Athlete`
- `activityId` (String?, unique) - **OPTIONAL FK to `AthleteActivity.id`**
- `weekIndex` (Int) - Copied from `TrainingDayPlanned`
- `dayIndex` (Int) - Copied from `TrainingDayPlanned`
- `date` (DateTime) - Copied from `TrainingDayPlanned`
- `plannedData` (Json?) - Snapshot of planned workout
- `analysis` (Json?) - AI analysis comparing actual vs planned
- `feedback` (Json?) - User feedback

**Relations:**
- `athlete` → `Athlete` (many-to-one)
- **NO direct FK to `AthleteActivity`** - Uses `activityId` string reference

**Critical Notes:**
- `activityId` is **optional** - Can be null (manual entry, no Garmin sync)
- `activityId` is **unique** - One activity can only link to one executed day
- Created when athlete completes a workout (auto-match or manual link)
- `plannedData` is a snapshot - preserves what was planned even if plan changes

---

## Flow: Garmin Webhook → Activity → Executed Day

### Step 1: Garmin Webhook Arrives

**Endpoint:** `POST /api/garmin/webhook`

**Payload:**
```json
{
  "activities": [
    {
      "activityId": "123456789",
      "activityType": "running",
      "startTime": "2024-01-15T06:00:00Z",
      "duration": 1800,
      "distance": 5000,
      ...
    }
  ],
  "userId": "garmin-user-guid-123"
}
```

**Process:**
1. Find athlete by `garminUserId`
2. Check if activity already exists (`sourceActivityId` lookup)
3. Create `AthleteActivity` record:
   ```typescript
   await prisma.athleteActivity.create({
     data: {
       athleteId: athlete.id,
       sourceActivityId: activity.activityId.toString(),
       source: 'garmin',
       activityType: activity.activityType,
       startTime: new Date(activity.startTime),
       duration: activity.duration,
       distance: activity.distance,
       summaryData: activity
     }
   });
   ```

**Result:** `AthleteActivity` record created with `id = "cuid-abc123"`

---

### Step 2: Auto-Match to Training Day

**Function:** `autoMatchActivityToDay(athleteId, activityId)`

**Location:** `lib/services/match-logic.ts`

**Process:**
1. Load `AthleteActivity` by `id`
2. Extract `startTime` → convert to date
3. Find `TrainingDayPlanned` for that date (±6 hours window)
4. Check if `TrainingDayExecuted` already exists for that date
5. Create `TrainingDayExecuted` with `activityId` link:

```typescript
const executed = await prisma.trainingDayExecuted.create({
  data: {
    athleteId,
    activityId: activity.id, // ← Links to AthleteActivity.id
    weekIndex: plannedDay.weekIndex,
    dayIndex: plannedDay.dayIndex,
    date: plannedDay.date,
    plannedData: plannedDay.plannedData
  }
});
```

**Result:** `TrainingDayExecuted` created with `activityId = "cuid-abc123"` (same as `AthleteActivity.id`)

---

### Step 3: Manual Linking (Alternative Flow)

**Endpoint:** `POST /api/training/match/[dayId]`

**Body:**
```json
{
  "activityId": "cuid-abc123"
}
```

**Process:**
1. Load `TrainingDayPlanned` by `dayId`
2. Check if `activityId` already linked to another day
3. Find or create `TrainingDayExecuted` for that date
4. Update/create with `activityId`:

```typescript
await prisma.trainingDayExecuted.upsert({
  where: { id: existingExecutedDay.id },
  create: {
    athleteId,
    activityId,
    weekIndex: plannedDay.weekIndex,
    dayIndex: plannedDay.dayIndex,
    date: plannedDay.date,
    plannedData: plannedDay.plannedData
  },
  update: {
    activityId // ← Link the activity
  }
});
```

---

## Relationship Diagram

```
┌─────────────────────┐
│   AthleteActivity   │
│                     │
│  id: "cuid-abc123"  │◄──┐
│  sourceActivityId:  │   │
│    "123456789"      │   │
│  startTime: ...     │   │
│  distance: 5000     │   │
└─────────────────────┘   │
                          │
                          │ activityId (optional, unique)
                          │
┌─────────────────────────┐│
│ TrainingDayExecuted     ││
│                         ││
│  id: "cuid-xyz789"     ││
│  activityId:            │┘
│    "cuid-abc123"        │
│  weekIndex: 3           │
│  dayIndex: 1            │
│  date: 2024-01-15       │
│  plannedData: {...}     │
└─────────────────────────┘
```

---

## Key Constraints & Rules

### 1. `activityId` is Optional
- `TrainingDayExecuted` can exist without `activityId` (manual entry)
- Not all executed days have Garmin activities
- Allows for manual workout logging

### 2. `activityId` is Unique
- One `AthleteActivity` can only link to one `TrainingDayExecuted`
- Prevents double-counting workouts
- Enforced by Prisma: `activityId String? @unique`

### 3. No Direct FK Relationship
- `TrainingDayExecuted.activityId` is a **string reference**, not a Prisma relation
- Must manually join: `prisma.athleteActivity.findUnique({ where: { id: executed.activityId } })`
- This is intentional - activities exist independently of training plans

### 4. Date-Based Matching
- Auto-match uses `startTime` from `AthleteActivity` → find `TrainingDayPlanned` by date
- Window: ±6 hours from planned day date
- If no match found, activity exists but isn't linked

---

## Query Patterns

### Get Activity for Executed Day

```typescript
const executed = await prisma.trainingDayExecuted.findUnique({
  where: { id: dayId },
  include: {
    // Can't use Prisma relation - must manually join
  }
});

if (executed?.activityId) {
  const activity = await prisma.athleteActivity.findUnique({
    where: { id: executed.activityId }
  });
}
```

### Get Executed Day for Activity

```typescript
const executed = await prisma.trainingDayExecuted.findFirst({
  where: { activityId: activityId }
});

// If found, this activity is linked to a training day
```

### Get Unlinked Activities

```typescript
const allActivities = await prisma.athleteActivity.findMany({
  where: { athleteId }
});

const linkedActivityIds = await prisma.trainingDayExecuted.findMany({
  where: {
    athleteId,
    activityId: { not: null }
  },
  select: { activityId: true }
}).then(results => results.map(r => r.activityId).filter(Boolean));

const unlinkedActivities = allActivities.filter(
  activity => !linkedActivityIds.includes(activity.id)
);
```

---

## Comparison: trainingmvp vs gofastapp-mvp

### trainingmvp (Current)
- `TrainingDayExecuted` has `activityId String? @unique`
- **NO** `executionId` FK
- Direct link: `athleteId` + `activityId` (optional)
- Simpler model - no execution container

### gofastapp-mvp
- `TrainingDayExecuted` has `executionId` FK to `TrainingPlanExecution`
- `TrainingDayExecuted` has `activityId String? @unique`
- More complex - execution container tracks plan lifecycle
- Same `activityId` pattern (optional, unique)

**Key Difference:** trainingmvp doesn't have `TrainingPlanExecution` - executed days link directly to athlete + optional activity.

---

## Future Considerations

### 1. Multiple Activities Per Day
**Current:** One `activityId` per `TrainingDayExecuted` (unique constraint)

**Question:** What if athlete does multiple runs in one day?
- Option A: Link only the primary activity
- Option B: Create multiple `TrainingDayExecuted` records (one per activity)
- Option C: Store array of `activityIds` (requires schema change)

**Recommendation:** Keep current model (one activity per day) - most common use case.

### 2. Activity Deletion
**Current:** If `AthleteActivity` is deleted, `TrainingDayExecuted.activityId` becomes orphaned (string reference, no FK cascade).

**Question:** Should we cascade delete `TrainingDayExecuted` if activity is deleted?

**Recommendation:** Keep `TrainingDayExecuted` even if activity deleted - preserves execution record.

### 3. Manual Activity Creation
**Current:** Activities only created via Garmin webhook.

**Question:** Should athletes be able to manually create activities?

**Recommendation:** Yes - add `POST /api/activities/create` for manual entry.

---

## Summary

**`activityId` is the bridge between:**
- **Garmin sync** (`AthleteActivity`) ← Raw activity data
- **Training execution** (`TrainingDayExecuted`) ← Completed workout record

**Key Points:**
1. `activityId` is **optional** - executed days can exist without Garmin activities
2. `activityId` is **unique** - one activity links to one executed day
3. **No Prisma FK** - uses string reference (activities exist independently)
4. **Auto-match** links activities to planned days by date
5. **Manual linking** allows athletes to connect activities to specific days

This design allows flexibility: athletes can log workouts manually OR sync from Garmin, and the system can match activities to planned training days automatically.


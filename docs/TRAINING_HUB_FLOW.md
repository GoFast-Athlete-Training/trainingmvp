# Training Hub Flow & Display Logic

## What the Training Hub Shows

The training hub (`/training` page) displays different content based on whether you have a training plan.

---

## Plan Lookup Logic

The hub route (`GET /api/training/hub`) checks for a plan in this order:

1. **AthleteTrainingPlan Junction Table** (most recent assignment)
   - Queries `AthleteTrainingPlan` ordered by `assignedAt desc`
   - Gets the `trainingPlan` relation
   - This is the primary source for MVP1

2. **Fallback: Active Plan**
   - If no junction entry, looks for `TrainingPlan` with `status: 'active'`
   - Ordered by `createdAt desc`

3. **Fallback: Draft Plan**
   - If no active plan, looks for `TrainingPlan` with `status: 'draft'`
   - Ordered by `createdAt desc`

4. **No Plan Found**
   - Returns `hasPlan: false`
   - Frontend shows landing page

---

## What You'll See: No Plan

If you (Adam Cole) **don't have a training plan**, you'll see:

### Landing Page
- **Title:** "Ready to Train?"
- **Subtitle:** "Create your personalized training plan and start crushing your goals"
- **Button:** "Set My Training Plan →"
- **Features:** 3 cards (Personalized Plans, Track Progress, Race Ready)

### OR Draft Plan Checklist (if you have a draft)

If you have a **draft plan** (created but not generated), you'll see:

- **Title:** "Continue Your Plan"
- **Checklist with 3 steps:**
  1. **Select Race** ✅ or 1️⃣
     - Shows race name/date if completed
     - Button to continue if not completed
  2. **Set Goal Time** ✅ or 2️⃣
     - Shows goal time if completed
     - Button to continue if race selected but goal not set
  3. **Review & Generate** 3️⃣
     - Button appears when both race and goal time are set

---

## What You'll See: Has Active Plan

If you **have an active training plan**, you'll see:

### Training Hub Dashboard

1. **Today's Workout Card**
   - **If rest day:** 😌 "Rest Day - No workout scheduled"
   - **If workout day:**
     - Workout label/type
     - Status badge: `pending`, `completed`, or `rest`
     - Distance (miles)
     - Target pace
     - "View Workout Details" button
   - **If no workout today:** "No workout scheduled for today"

2. **Plan Status Card**
   - "Week X of Y - [phase] Phase"
   - "View Full Plan →" button

3. **Race Readiness Snapshot** (if available)
   - Current 5K Pace
   - Goal Delta
   - Status badge: `on-track`, `behind`, or `impossible`

4. **Quick Actions**
   - "View Plan" button
   - "This Week" button

---

## How to Check If You Have a Plan

### Option 1: Check the Database Directly

```sql
-- Check if you have any training plans
SELECT 
  tp.id,
  tp.name,
  tp.status,
  tp."startDate",
  tp."totalWeeks",
  atp."assignedAt"
FROM "TrainingPlan" tp
LEFT JOIN "athlete_training_plans" atp ON tp.id = atp."trainingPlanId"
WHERE tp."athleteId" = 'YOUR_ATHLETE_ID'
ORDER BY tp."createdAt" DESC;

-- Check junction table entries
SELECT * FROM "athlete_training_plans" 
WHERE "athleteId" = 'YOUR_ATHLETE_ID'
ORDER BY "assignedAt" DESC;
```

### Option 2: Check via API

```bash
# Get your athlete ID first (from localStorage or /athlete/hydrate)
# Then check training hub
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-domain.com/api/training/hub

# Response will show:
# - hasPlan: true/false
# - todayWorkout: null or workout object
# - planStatus: { hasPlan, totalWeeks, currentWeek, phase }
```

### Option 3: Check Browser Console

When you visit `/training`, check the browser console for:
```
📊 TRAINING PAGE: Plan status: { hasPlan: true/false, ... }
```

---

## Current State for Adam Cole

Based on the code logic, here's what will happen:

1. **First Check:** `AthleteTrainingPlan` junction table
   - If you've generated a plan, there should be an entry here
   - Ordered by `assignedAt desc` (most recent first)

2. **Second Check:** `TrainingPlan` with `status: 'active'`
   - If you have an active plan but no junction entry (legacy)

3. **Third Check:** `TrainingPlan` with `status: 'draft'`
   - If you started creating a plan but didn't generate it yet

4. **Result:**
   - If any of the above exist → Shows training hub with today's workout
   - If none exist → Shows landing page with "Set My Training Plan" button

---

## What the Hub Route Returns

### If No Plan:
```json
{
  "todayWorkout": null,
  "planStatus": {
    "hasPlan": false,
    "totalWeeks": 0,
    "currentWeek": 0,
    "phase": ""
  },
  "raceReadiness": null
}
```

### If Has Plan:
```json
{
  "todayWorkout": {
    "id": "day-id",
    "date": "2025-12-04T...",
    "dayOfWeek": 3,
    "warmup": [...],
    "workout": [...],
    "cooldown": [...],
    "notes": "...",
    "status": "pending" | "completed" | "rest"
  },
  "planStatus": {
    "hasPlan": true,
    "totalWeeks": 16,
    "currentWeek": 5,
    "phase": "build"
  },
  "raceReadiness": {
    "goal5kPace": "7:30",
    "status": "on-track"
  }
}
```

---

## Key Points

1. **Junction Table is Primary:** MVP1 uses `AthleteTrainingPlan` as the primary lookup
2. **Draft Plans Also Shown:** Draft plans are included in the lookup (not just active)
3. **Today's Workout:** Uses `TrainingPlanDay` with date lookup (new date-driven model)
4. **No Plan = Landing Page:** If no plan found, shows setup flow instead of hub

---

## To Answer Your Question

**"Does Adam Cole currently have a trainingPlanId?"**

The hub will check:
1. `AthleteTrainingPlan` junction table → `trainingPlanId`
2. `TrainingPlan` table → `id` where `athleteId = YOUR_ID` and `status IN ('active', 'draft')`

**If you have a plan:**
- Hub shows today's workout, plan status, race readiness
- You can view full plan, this week's workouts, etc.

**If you don't have a plan:**
- Hub shows landing page with "Set My Training Plan" button
- Clicking it creates a draft plan and redirects to `/training-setup/start`

The easiest way to check: **Visit `/training` and see what displays!**


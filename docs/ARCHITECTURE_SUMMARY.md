# Training System Architecture Summary

**Single Source of Truth:** `TRAINING_ARCHITECTURE.md` (root directory)

---

## Core Architecture Pattern

### Master Container: TrainingPlan

**TrainingPlan** is the master container that holds:
- Plan metadata (name, goal time, start date, status)
- Links to Race via `RaceTrainingPlan` junction table
- Links to Athlete via `AthleteTrainingPlan` junction table
- Contains all planned days via `TrainingDayPlanned[]`

### Junction Tables

1. **RaceTrainingPlan**
   - Links `Race` ↔ `TrainingPlan` (many-to-many)
   - This is where the "lock in" happens - a plan is linked to a race
   - One plan can target one race
   - One race can have many plans

2. **AthleteTrainingPlan**
   - Links `Athlete` ↔ `TrainingPlan` (many-to-many)
   - MVP1: Only created when plan is generated
   - Future: Will support "My Training Plans" selection screen
   - No boolean flags (`isActive`, `isPrimary`) - just `assignedAt` timestamp

---

## Execution & Hydration Pattern

### Key Insight

**OpenAI generates the complete plan (all weeks, all days) at once.** We don't need a separate "execution container" table because the plan is already complete.

### Plan Generation (All-at-Once)

When `POST /api/training-plan/generate` is called:

1. **OpenAI generates ALL weeks and ALL days** in a single response
   - Example: 16-week plan = 112 days (16 weeks × 7 days)
   - Each day has complete workout details in `plannedData` JSON

2. **We create ALL `TrainingDayPlanned` records immediately**
   - Each record has:
     - `plannedData` (JSON) - Complete workout details from AI
     - `date` - Computed from `planStartDate + weekIndex + dayIndex`
     - `weekIndex`, `dayIndex`, `phase` - From AI response

3. **All within a single Prisma transaction**
   - Updates `TrainingPlan` status to "active"
   - Creates `AthleteTrainingPlan` junction entry
   - Creates all `TrainingDayPlanned` records

### Execution (Hydrate-on-Create)

When athlete completes a workout:

1. **Auto-match or Manual Link**
   - `autoMatchActivityToDay()` finds `TrainingDayPlanned` by date
   - OR user manually selects activity to link to planned day

2. **Create `TrainingDayExecuted`**
   - **HYDRATES `plannedData` from `TrainingDayPlanned.plannedData`** (snapshot)
   - Copies `weekIndex`, `dayIndex`, `date` from `TrainingDayPlanned`
   - Links `activityId` to `AthleteActivity` (if Garmin sync)
   - `analysis` computed later (comparing actual vs planned)

3. **Why Hydrate?**
   - **Snapshot:** Preserves what was planned even if plan changes later
   - **Performance:** No need to join `TrainingDayPlanned` every time we display execution
   - **Flexibility:** Can have execution without planned day (manual entry)

### Data Flow Diagram

```
PLAN GENERATION:
  OpenAI → GeneratedPlan (all weeks/days)
    ↓
  Prisma Transaction:
    - Update TrainingPlan (status: "active")
    - Create ALL TrainingDayPlanned records (112 for 16 weeks)
    - Create AthleteTrainingPlan junction entry

EXECUTION:
  Athlete completes workout
    ↓
  Garmin sync → AthleteActivity created
    ↓
  Auto-match finds TrainingDayPlanned by date
    ↓
  Create TrainingDayExecuted:
    - plannedData = TrainingDayPlanned.plannedData (HYDRATED)
    - weekIndex, dayIndex, date = copied from TrainingDayPlanned
    - activityId = AthleteActivity.id
    ↓
  Compute analysis (actual vs planned)
    ↓
  Update TrainingDayExecuted.analysis
```

---

## Key Architecture Decisions

### ✅ What We Have

1. **TrainingPlan** - Master container
   - Holds plan metadata
   - Links to Race via junction table
   - Links to Athlete via junction table

2. **TrainingDayPlanned** - All days created at once
   - Created when plan is generated
   - Contains complete workout details from AI
   - Dates computed by backend (not from AI)

3. **TrainingDayExecuted** - Created on workout completion
   - Hydrates `plannedData` from `TrainingDayPlanned` (snapshot)
   - Links to `AthleteActivity` via `activityId`
   - No direct FK to `TrainingPlan` (links via `athleteId + date`)

### ❌ What We DON'T Have

1. **No TrainingPlanExecution table**
   - We don't need a separate "execution instance"
   - OpenAI gives us the complete plan upfront
   - Each `TrainingDayPlanned` is already atomic
   - Execution is just linking activities to planned days

2. **No Snapshot Tables**
   - No `TrainingPlanFiveKPace` snapshot
   - No `TrainingPlanPreferredDays` snapshot
   - All data lives on main models (`TrainingPlan`, `Athlete`)

3. **No Boolean Flags**
   - No `isActive`, `isPrimary` on `AthleteTrainingPlan`
   - No `isGlobal` on `Race`
   - Simple timestamp-based ordering (`assignedAt`)

---

## Model Relationships

```
TrainingPlan (master container)
  ├── RaceTrainingPlan (junction) → Race
  ├── AthleteTrainingPlan (junction) → Athlete
  └── TrainingDayPlanned[] (all days, created at once)

TrainingDayPlanned
  └── (hydrates) → TrainingDayExecuted.plannedData (on create)

TrainingDayExecuted
  └── activityId → AthleteActivity (optional, Garmin sync)
```

---

## Why This Architecture?

### 1. OpenAI Generates Everything
- **Reality:** OpenAI gives us the complete plan (all weeks, all days) in one response
- **Decision:** Create all `TrainingDayPlanned` records immediately
- **Benefit:** No incremental loading, no "We thought we would have a separate table to hydrate but then realized OpenAI gives the whole dang blog on generation"

### 2. Hydration Pattern
- **Reality:** We need to preserve what was planned even if plan changes
- **Decision:** Hydrate `plannedData` when creating `TrainingDayExecuted`
- **Benefit:** Historical accuracy, performance, flexibility

### 3. No Execution Container
- **Reality:** Each planned day is already atomic
- **Decision:** No `TrainingPlanExecution` table needed
- **Benefit:** Simpler schema, less joins

---

## Files Structure

### Single Source of Truth
- **`TRAINING_ARCHITECTURE.md`** (root) - ⚠️ **THIS IS THE SINGLE SOURCE OF TRUTH**

### Supporting Documentation (in `docs/`)
- `ARCHITECTURE_COMPLIANCE.md` - Compliance checks
- `SCHEMA_FIRST_ARCHITECTURE.md` - Schema-first approach doc
- `GOFAST_TRAINING_ARCHITECTURE.md` - Older version (archived)
- `FORENSIC_ARCHITECTURE_AUDIT.md` - Audit document
- `MODELS_REFERENCE.md` - Detailed model reference
- `ROUTE_AUDIT_REPORT.md` - API route audit
- `TRAINING_PLAN_GENERATOR.md` - Generator service docs

---

## Quick Reference

### Finding Active Plan (MVP1)
```typescript
// Try AthleteTrainingPlan junction first
const assignment = await prisma.athleteTrainingPlan.findFirst({
  where: { athleteId },
  orderBy: { assignedAt: 'desc' },
});

// Fallback to latest active or draft plan
let plan = assignment?.trainingPlan;
if (!plan) {
  plan = await prisma.trainingPlan.findFirst({
    where: { athleteId, status: 'active' },
  });
}
```

### Creating Execution Record
```typescript
// Hydrate from planned day
const executed = await prisma.trainingDayExecuted.create({
  data: {
    athleteId,
    activityId,
    weekIndex: plannedDay.weekIndex,      // Copied
    dayIndex: plannedDay.dayIndex,         // Copied
    date: plannedDay.date,                 // Copied
    plannedData: plannedDay.plannedData,  // HYDRATED (snapshot)
  },
});
```

### Finding Race for Plan
```typescript
// Via junction table
const plan = await prisma.trainingPlan.findUnique({
  where: { id: planId },
  include: {
    raceTrainingPlans: {
      include: {
        race: true,  // Note: race, not raceRegistry
      },
    },
  },
});

const race = plan.raceTrainingPlans[0]?.race;
```

---

**Last Updated:** 2025-01-XX  
**Status:** Current Architecture  
**Reference:** `TRAINING_ARCHITECTURE.md`


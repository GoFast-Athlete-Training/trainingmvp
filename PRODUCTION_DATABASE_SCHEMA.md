# Production Database Schema

**Generated:** 2024-12-06  
**Source:** Direct introspection from production database via `prisma db pull`

## Overview

This document reflects the **exact** structure of the production database. Use this as the source of truth when updating the Prisma schema.

---

## Models

### Athlete

**Table Name:** `Athlete` (PascalCase - Prisma default, no @@map)

```prisma
model Athlete {
  id                      String                   @id @default(cuid())
  firebaseId              String                   @unique
  email                   String?
  companyId               String
  firstName               String?
  lastName                String?
  gofastHandle            String?                  @unique
  photoURL                String?
  phoneNumber             String?
  birthday                DateTime?
  gender                  String?
  city                    String?
  state                   String?
  primarySport            String?
  bio                     String?
  instagram               String?
  myCurrentPace           String?
  myWeeklyMileage         Int?
  myTrainingGoal          String?
  myTrainingStartDate     DateTime?
  myTargetRace            String?
  preferredDistance       String?
  myPaceRange             String?
  timePreference          String?
  myRunningGoals          String?
  garmin_user_id          String?                  @unique
  garmin_access_token     String?
  garmin_refresh_token    String?
  garmin_expires_in       Int?
  garmin_scope            String?
  garmin_connected_at     DateTime?
  garmin_last_sync_at     DateTime?
  garmin_is_connected     Boolean                  @default(false)
  garmin_disconnected_at  DateTime?
  garmin_permissions      Json?
  garmin_user_profile     Json?
  garmin_user_sleep       Json?
  garmin_user_preferences Json?
  strava_id               Int?                     @unique
  strava_access_token     String?
  strava_refresh_token    String?
  strava_expires_at       Int?
  createdAt               DateTime                 @default(now())
  updatedAt               DateTime                 @updatedAt
  fiveKPace               String?
  
  // Relations
  company                 GoFastCompany            @relation(fields: [companyId], references: [id])
  Race                    Race[]
  TrainingDayExecuted     TrainingDayExecuted[]
  TrainingDayPlanned      TrainingDayPlanned[]
  trainingPlans           TrainingPlan[]
  activities              AthleteActivity[]
  run_crew_announcements  run_crew_announcements[]
  run_crew_event_rsvps    run_crew_event_rsvps[]
  run_crew_events          run_crew_events[]
  run_crew_managers        run_crew_managers[]
  run_crew_memberships     run_crew_memberships[]
  run_crew_messages        run_crew_messages[]
  run_crew_run_rsvps       run_crew_run_rsvps[]
  run_crew_runs            run_crew_runs[]
}
```

**Key Points:**
- Table name is `Athlete` (PascalCase) - **NOT** `athletes` (lowercase)
- `companyId` is required (NOT nullable)
- `fiveKPace` exists and is nullable
- Foreign key: `companyId` → `go_fast_companies.id`

---

### GoFastCompany

**Table Name:** `go_fast_companies` (snake_case with @@map)

```prisma
model GoFastCompany {
  id        String    @id @default(cuid())
  name      String
  slug      String    @unique
  address   String?
  city      String?
  state     String?
  zip       String?
  domain    String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  athletes  Athlete[]

  @@map("go_fast_companies")
}
```

**Key Points:**
- Table name is `go_fast_companies` (lowercase, snake_case)
- `name` and `slug` are **NOT nullable** in production (String, not String?)
- **MUST** use `@@map("go_fast_companies")` to map to the actual table

---

### AthleteActivity

**Table Name:** `athlete_activities` (snake_case with @@map)

```prisma
model AthleteActivity {
  id               String    @id @default(cuid())
  athleteId        String
  sourceActivityId String    @unique
  source           String    @default("garmin")
  activityType     String?
  activityName     String?
  startTime        DateTime?
  duration         Int?
  distance         Float?
  calories         Int?
  averageSpeed      Float?
  averageHeartRate Int?
  maxHeartRate     Int?
  elevationGain     Float?
  steps            Int?
  startLatitude     Float?
  startLongitude   Float?
  endLatitude       Float?
  endLongitude      Float?
  summaryPolyline   String?
  summaryData       Json?
  detailData        Json?
  hydratedAt        DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  athlete           Athlete   @relation(fields: [athleteId], references: [id])

  @@map("athlete_activities")
}
```

---

### TrainingPlan

**Table Name:** `TrainingPlan` (PascalCase - Prisma default, no @@map)

```prisma
model TrainingPlan {
  id                                String                  @id @default(cuid())
  athleteId                         String
  raceId                            String?
  status                            String                  @default("draft")
  createdAt                         DateTime                @default(now())
  updatedAt                         DateTime                @updatedAt
  trainingPlanAdaptive5kTime        String?
  trainingPlanBaseline5k            String
  trainingPlanBaselineWeeklyMileage Int?
  trainingPlanGoalPace              String?
  trainingPlanGoalTime              String
  trainingPlanName                  String
  trainingPlanStartDate             DateTime
  trainingPlanTotalWeeks            Int
  TrainingDayPlanned                TrainingDayPlanned[]
  TrainingPhase                     TrainingPhase[]
  athlete                           Athlete                 @relation(fields: [athleteId], references: [id])
  race                              Race?                   @relation(fields: [raceId], references: [id])
  TrainingPlanExecution             TrainingPlanExecution[]
}
```

**Note:** Field names use `trainingPlan*` prefix (camelCase), not the shorter names in the current schema.

---

### Race

**Table Name:** `Race` (PascalCase - Prisma default, no @@map)

```prisma
model Race {
  id                 String         @id
  raceName           String
  raceType           String
  raceDate           DateTime
  location           String?
  distanceMiles      Float
  registrationUrl   String?
  description        String?
  createdByAthleteId String?
  createdAt          DateTime       @default(now())
  updatedAt          DateTime
  Athlete            Athlete?       @relation(fields: [createdByAthleteId], references: [id])
  trainingPlans      TrainingPlan[]
}
```

---

### TrainingDayExecuted

**Table Name:** `TrainingDayExecuted` (PascalCase - Prisma default, no @@map)

```prisma
model TrainingDayExecuted {
  id                    String                @id
  executionId           String
  athleteId             String
  activityId            String?               @unique
  weekIndex             Int
  dayIndex              Int
  date                  DateTime
  plannedData           Json?
  analysis              Json?
  feedback              Json?
  createdAt             DateTime              @default(now())
  updatedAt             DateTime
  Athlete               Athlete               @relation(fields: [athleteId], references: [id])
  TrainingPlanExecution TrainingPlanExecution @relation(fields: [executionId], references: [id])

  @@unique([executionId, date])
}
```

---

### TrainingDayPlanned

**Table Name:** `TrainingDayPlanned` (PascalCase - Prisma default, no @@map)

```prisma
model TrainingDayPlanned {
  id              String         @id
  trainingPlanId  String
  trainingPhaseId String?
  athleteId       String
  date            DateTime
  weekIndex       Int
  dayIndex        Int
  dayName         String?
  phase           String
  plannedData     Json
  createdAt       DateTime       @default(now())
  updatedAt       DateTime
  Athlete         Athlete        @relation(fields: [athleteId], references: [id])
  TrainingPhase   TrainingPhase? @relation(fields: [trainingPhaseId], references: [id])
  TrainingPlan    TrainingPlan   @relation(fields: [trainingPlanId], references: [id])

  @@unique([trainingPlanId, weekIndex, dayIndex])
}
```

---

### TrainingPhase

**Table Name:** `TrainingPhase` (PascalCase - Prisma default, no @@map)

```prisma
model TrainingPhase {
  id                 String               @id
  trainingPlanId     String
  phaseName          String
  phaseIndex         Int
  startWeek          Int
  endWeek            Int
  metadata           Json?
  createdAt          DateTime             @default(now())
  updatedAt          DateTime
  TrainingDayPlanned TrainingDayPlanned[]
  TrainingPlan       TrainingPlan         @relation(fields: [trainingPlanId], references: [id])
}
```

---

### TrainingPlanExecution

**Table Name:** `TrainingPlanExecution` (PascalCase - Prisma default, no @@map)

```prisma
model TrainingPlanExecution {
  id                  String                @id
  trainingPlanId      String
  startedAt           DateTime
  status              String                @default("active")
  createdAt           DateTime              @default(now())
  updatedAt           DateTime
  TrainingDayExecuted TrainingDayExecuted[]
  TrainingPlan        TrainingPlan          @relation(fields: [trainingPlanId], references: [id])
}
```

---

## Run Crew Models (from gofastapp-mvp)

These models exist in the production database but are not part of the training module:

- `join_codes`
- `run_crew_announcements`
- `run_crew_event_rsvps`
- `run_crew_events`
- `run_crew_managers`
- `run_crew_memberships`
- `run_crew_messages`
- `run_crew_run_rsvps`
- `run_crew_runs`
- `run_crews`

---

## Critical Foreign Key Constraints

### Athlete → GoFastCompany

```sql
FOREIGN KEY ("companyId") 
REFERENCES "go_fast_companies"("id") 
ON DELETE RESTRICT 
ON UPDATE CASCADE
```

**IMPORTANT:** The foreign key points to `go_fast_companies` (lowercase, snake_case), **NOT** `GoFastCompany` (PascalCase).

---

## Table Naming Conventions

| Model Name | Table Name | Mapping |
|------------|------------|---------|
| `Athlete` | `Athlete` | No @@map (Prisma default PascalCase) |
| `GoFastCompany` | `go_fast_companies` | `@@map("go_fast_companies")` |
| `AthleteActivity` | `athlete_activities` | `@@map("athlete_activities")` |
| `TrainingPlan` | `TrainingPlan` | No @@map (Prisma default PascalCase) |
| `Race` | `Race` | No @@map (Prisma default PascalCase) |
| `TrainingDayExecuted` | `TrainingDayExecuted` | No @@map (Prisma default PascalCase) |
| `TrainingDayPlanned` | `TrainingDayPlanned` | No @@map (Prisma default PascalCase) |
| `TrainingPhase` | `TrainingPhase` | No @@map (Prisma default PascalCase) |
| `TrainingPlanExecution` | `TrainingPlanExecution` | No @@map (Prisma default PascalCase) |

---

## Notes

1. **Do NOT create migrations** that modify `go_fast_companies` table - it already exists and is correct
2. **Do NOT recreate** the `Athlete_companyId_fkey` foreign key - it's already correct
3. **Do NOT rename** tables - use `@@map` to match existing table names
4. The `GoFastCompany.name` and `GoFastCompany.slug` fields are **NOT nullable** in production (String, not String?)

---

## How to Update Schema

1. **Pull from production:**
   ```bash
   npx prisma db pull
   ```

2. **Review differences:**
   ```bash
   git diff prisma/schema.prisma
   ```

3. **Update schema.prisma** to match production exactly

4. **Generate client:**
   ```bash
   npx prisma generate
   ```

5. **DO NOT run migrations** - schema should match production without changes


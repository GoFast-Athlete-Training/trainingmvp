# Persona & goal catalog (Training Manage)

Training Manage owns **`training_plan_persona`** and **`training_plan_goal`** in Neon (parity with prod). Presets link via `personaId` / `goalId` on `training_plan_preset`.

Prod remains the read source until you run **copy from prod**; then HQ can point proxies at TM and retire prod tables.

## Schema (Prisma)

### `training_plan_persona`

| Column | Type | Notes |
|--------|------|--------|
| `id` | String @id | Preserve prod id on copy |
| `slug` | String @unique | |
| `title` | String | |
| `capability` | AthletePersonaCapability? | |
| `dedication` | AthletePersonaDedication? | |
| `personaGoalLabel` | String? | |
| `workoutFrequencyCap` | Int? | |
| `intentSummary` | String? | |
| `runningHistory` | String? | |
| `runningHistorySummary` | String? | |
| `currentCapability` | String? | |
| `currentCapabilitySummary` | String? | |
| `injuryAssessment` | String? | |
| `injuryAssessmentSummary` | String? | |
| `dedicationText` | String? | |
| `dedicationSummary` | String? | |
| `abilityToTrain` | String? | |
| `abilityToTrainSummary` | String? | |
| `estimated5kTimeSeconds` | Int? | |
| `estimated5kPerformanceSummary` | String? | |
| `estimated5kPerformanceRationale` | String? | |
| `athletePersonaSummary` | String? | |
| `createdAt` / `updatedAt` | DateTime | |

### `training_plan_goal`

| Column | Type | Notes |
|--------|------|--------|
| `id` | String @id | Preserve prod id on copy |
| `slug` | String @unique | |
| `personaId` | String FK → persona | |
| `targetDistanceLabel` | String? | |
| `objectiveOfPlan` | String? | |
| `planDurationWeeks` | Int | |
| `timeHorizonLabel` | String? | |
| `fitnessDelta` | FitnessDelta? | |
| `progressionAggressiveness` | ProgressionAggressiveness? | |
| `intensityReasoning` | String? | |
| `goalKind` | TrainingPlanGoalKind? | |
| `goalType` | TrainingPlanGoalType? | |
| `coachIntent` | String? | |
| `createdAt` / `updatedAt` | DateTime | |

Enums match prod: `AthletePersonaCapability`, `AthletePersonaDedication`, `FitnessDelta`, `ProgressionAggressiveness`, `TrainingPlanGoalKind`, `TrainingPlanGoalType`.

## APIs (Training Manage)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/training/plan-persona?all=1` | List all personas on TM |
| GET | `/api/training/plan-persona?slug=` | One persona by slug |
| GET | `/api/training/plan-goal?all=1` | List all goals on TM |
| GET | `/api/training/plan-goal?slug=` | One goal by slug |
| POST | `/api/training/plan-persona/sync-from-prod` | Fetch prod `?all=1` + upsert into TM |

Auth: Firebase Bearer + `x-gofast-staff-id` (HQ forward or Training Manager session header).

## Copy from prod

1. Set **`GOFAST_APP_API_URL`** on Training Manage Vercel (prod athlete app URL).
2. Deploy prod change that supports `GET /api/training/plan-persona?all=1` and `GET /api/training/plan-goal?all=1`.
3. In TM: **Dashboard → Personas (stub)** → **Copy from prod**, or:

```bash
curl -X POST "https://training.gofastcrushgoals.com/api/training/plan-persona/sync-from-prod" \
  -H "Authorization: Bearer <firebase-id-token>" \
  -H "x-gofast-staff-id: <staff-or-manager-id>"
```

Response includes `fetchedFromProd`, `personasUpserted`, `goalsUpserted`, `skippedGoalsMissingPersona`.

## After copy

- Point GoFastCompany `/api/training/plan-persona*` and `plan-goal*` proxies at Training Manage instead of prod.
- Remove prod `training_plan_persona` / `training_plan_goal` usage when presets and generate no longer read prod catalog.

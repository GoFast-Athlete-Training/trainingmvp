# GoFast Training Module (MVP3)

A self-contained Next.js 14 App Router training module for GoFast, built with Prisma, OpenAI, and modern React patterns.

## Overview

This module provides a complete training plan management system with:
- **Training Hub** - Central dashboard showing today's workout, plan status, and race readiness
- **Plan Overview** - Visual breakdown of training phases (Base, Build, Peak, Taper) and weeks
- **Week View** - 7-day calendar view of workouts for a specific week
- **Day View** - Detailed workout view with planned data, actual execution, and Garmin matching
- **Match & Analysis** - Link Garmin activities to training days and compute GoFastScore

## Architecture

### Data Models (Prisma)

- **TrainingPlan** - Container for the entire training cycle
- **TrainingDayPlanned** - Individual planned workout days
- **TrainingDayExecuted** - Completed workouts linked to activities
- **AthleteActivity** - Garmin-synced activities
- **Athlete** - User profile with adaptive metrics
- **Race** - Race goals and targets

### Services

- **extraction.ts** - OpenAI-powered extraction from conversational input
- **plan-generator.ts** - AI-generated training plans with all weeks/days
- **match-logic.ts** - Garmin activity matching (auto + manual)
- **analysis.ts** - GoFastScore computation and adaptive 5K updates

### API Routes

- `/api/training/hub` - Training hub data (today's workout, plan status, race readiness)
- `/api/training/plan` - Plan overview with phases
- `/api/training/plan/[weekIndex]` - Week view with 7 days
- `/api/training/day/[dayId]` - Day view with planned + actual data
- `/api/training/match/[dayId]` - Match activities to days and compute scores

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database
- OpenAI API key

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/gofast"
OPENAI_API_KEY="sk-..."
NEXT_PUBLIC_TEST_ATHLETE_ID="test-athlete-id"  # For testing without auth
```

3. Generate Prisma client:
```bash
npm run db:generate
```

4. Push schema to database:
```bash
npm run db:push
```

5. Run development server:
```bash
npm run dev
```

## Usage

### Training Hub (`/training`)

The main dashboard showing:
- Today's workout (or rest day)
- Plan status (current week, phase)
- Race readiness snapshot (adaptive 5K, goal delta, on-track status)

### Plan Overview (`/training/plan`)

View the complete training plan:
- Phase breakdown (Base, Build, Peak, Taper)
- Weekly mileage progression
- Click any week to view details

### Week View (`/training/plan/[weekIndex]`)

7-day calendar view:
- Each day shows workout type, mileage, pace
- Status badges (pending/completed/rest)
- Click day to view details

### Day View (`/training/day/[dayId]`)

Detailed workout view:
- Planned workout (type, distance, pace, HR zones, segments)
- Actual data (if completed via Garmin)
- Auto-match candidates (if Garmin activities found)
- "Match Workout" button for manual matching

### Match & Analysis (`/training/match/[dayId]`)

Link Garmin activities to training days:
- List of activities for that day
- Select activity to match
- Automatically computes GoFastScore
- Updates adaptive 5K time on athlete

## OpenAI Integration

### Extraction Mode

Extracts structured data from conversational input:
```typescript
const inputs = await extractTrainingInputs(
  "I'm training for the Boston Marathon on April 15th. My goal is 3:30:00. My current 5K pace is 8:30 per mile and I run 25 miles per week."
);
```

### Plan Generation Mode

Generates complete training plan:
```typescript
const plan = await generateTrainingPlanAI({
  raceName: "Boston Marathon",
  raceDate: "2025-04-15",
  raceDistance: "marathon",
  goalTime: "3:30:00",
  baseline5k: "8:30",
  weeklyMileage: 25,
});
```

**Important**: Plan generation creates ALL weeks and days immediately (not incrementally).

## GoFastScore Analysis

The system computes a comprehensive score based on:
- **Pace Variance** - How close actual pace matches planned
- **HR Zone Hit Percent** - Heart rate zone compliance
- **Mileage Variance** - Distance adherence
- **Workout Quality Score** - Combined metric (0-100)
- **Week Trend Score** - Weekly progression trend
- **Overall Score** - Weighted combination

After each matched workout, the adaptive 5K time is updated:
```
new5k = old5k - (qualityScore * 0.8 seconds)
```

## Garmin Matching

### Auto-Match

When a Garmin activity is synced:
1. System checks if activity date matches a planned day
2. If match found and no existing execution, auto-creates `TrainingDayExecuted`
3. Computes analysis and updates adaptive metrics

### Manual Match

If auto-match fails or user wants to choose:
1. Navigate to day view
2. Click "Match Workout"
3. Select from list of activities for that day
4. System links activity, computes score, updates metrics

## Testing

Currently uses `NEXT_PUBLIC_TEST_ATHLETE_ID` for testing without authentication. Replace with actual auth system when integrating into main app.

## Future Integration

This module is designed to be merged into the main GoFast app. When integrating:
1. Replace test athlete ID with actual auth
2. Connect to existing user/athlete system
3. Integrate with Garmin webhook handlers
4. Add race creation flow (currently assumes race exists)

## File Structure

```
/app
  /training
    page.tsx                    # Training Hub
    /plan
      page.tsx                  # Plan Overview
      /[weekIndex]
        page.tsx                # Week View
    /day
      /[dayId]
        page.tsx                # Day View
    /match
      /[dayId]
        page.tsx                # Match & Analysis
  /api/training
    /hub/route.ts
    /plan/route.ts
    /plan/[weekIndex]/route.ts
    /day/[dayId]/route.ts
    /match/[dayId]/route.ts
/lib
  /services
    extraction.ts              # OpenAI extraction
    plan-generator.ts          # AI plan generation
    match-logic.ts             # Garmin matching
    analysis.ts                # GoFastScore computation
  /utils
    dates.ts                   # Date utilities
    pace.ts                    # Pace calculations
  prisma.ts                    # Prisma client
/prisma
  schema.prisma                # Database schema
```

## Notes

- All training logic happens in services (not frontend)
- Plan generation creates all days immediately (no incremental generation)
- Uses existing Prisma models (no new tables)
- Strict JSON parsing for OpenAI responses
- Handles empty states gracefully (no plan, no workout, etc.)


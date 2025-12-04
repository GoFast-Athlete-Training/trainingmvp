# Training Plan Generator Service

**Purpose:** Generate complete, personalized training plans using OpenAI GPT-4o-mini  
**Location:** `lib/training/plan-generator.ts`  
**API Endpoint:** `POST /api/training-plan/generate`

---

## Overview

The Training Plan Generator is an AI-powered service that creates complete, week-by-week training plans based on:
- Race information (name, distance)
- Goal time
- Athlete's current 5K pace
- Total weeks until race

The service generates **all weeks and days immediately** (not incrementally), then saves them to the database in a single atomic transaction.

---

## Service Architecture

### Entry Point
**File:** `app/api/training-plan/generate/route.ts`  
**Function:** `POST(request: NextRequest)`

### Core Service
**File:** `lib/training/plan-generator.ts`  
**Function:** `generateTrainingPlanAI(inputs: TrainingInputs): Promise<GeneratedPlan>`

### Data Flow

```
1. API Route receives trainingPlanId
   ↓
2. Validates draft plan exists, has goal time, start date, and race attached
   ↓
3. Loads athlete's current 5K pace
   ↓
4. Calculates goalFiveKPace (if not already set)
   ↓
5. Calls generateTrainingPlanAI() with inputs
   ↓
6. OpenAI generates complete plan (all weeks, all days)
   ↓
7. Parses JSON response
   ↓
8. Prisma transaction:
   - Updates TrainingPlan status to "active"
   - Sets goalFiveKPace
   - Creates AthleteTrainingPlan junction entry
   - Creates ALL TrainingDayPlanned records with computed dates
   ↓
9. Returns trainingPlanId
```

---

## Inputs

### TrainingInputs Interface
```typescript
export interface TrainingInputs {
  raceName: string;        // e.g., "Boston Marathon"
  raceDistance: string;    // e.g., "marathon", "half", "5k", "10k"
  goalTime: string;        // e.g., "3:30:00" (HH:MM:SS format)
  fiveKPace: string;       // e.g., "7:30" (mm:ss format per mile)
  totalWeeks: number;      // Calculated from race date - plan start date
}
```

### Where Inputs Come From

| Input | Source | Location |
|-------|--------|----------|
| `raceName` | `Race.name` | Junction table: `raceTrainingPlans[0].race.name` |
| `raceDistance` | `Race.distance` | Junction table: `raceTrainingPlans[0].race.distance` |
| `goalTime` | `TrainingPlan.trainingPlanGoalTime` | Draft plan field |
| `fiveKPace` | `Athlete.fiveKPace` | Athlete profile (current fitness) |
| `totalWeeks` | `TrainingPlan.trainingPlanTotalWeeks` | Calculated when plan created |

---

## The OpenAI Prompt

### System Message
```
You are a professional running coach. Generate complete training plans. Always return valid JSON only.
```

### User Message (Full Prompt)

```
You are a professional running coach creating a training plan using the GoFast Training Model.

GoFast Training Model:
- Base Phase (~25% of total weeks): Foundation building, easy runs, base mileage, low intensity
- Build Phase (~35% of total weeks): Gradual mileage increase, tempo runs, intervals, strength building
- Peak Phase (~20% of total weeks): Highest mileage, race-specific workouts, pace work, tune-up races
- Taper Phase (remaining weeks): Reduce mileage 30% per week, maintain intensity, race pace work

Workout Types:
- easy: Easy pace runs for base building
- tempo: Sustained effort at threshold pace
- intervals: High-intensity intervals with recovery
- long_run: Long distance runs for endurance
- rest: Recovery days

Inputs:
- Race: ${inputs.raceName} (${inputs.raceDistance})
- Goal Time: ${inputs.goalTime}
- 5K Pace: ${inputs.fiveKPace} per mile
- Total Weeks: ${inputs.totalWeeks}

You must return EXACT JSON ONLY (no markdown, no explanation):
{
  "totalWeeks": ${inputs.totalWeeks},
  "weeks": [
    {
      "weekIndex": 1,
      "phase": "base",
      "days": [
        {
          "dayIndex": 1,
          "plannedData": {
            "type": "easy",
            "mileage": 4,
            "paceRange": "8:30-9:00",
            "hrZone": "2",
            "hrRange": "130-150",
            "label": "Easy Run",
            "description": "Comfortable pace, conversational"
          }
        }
      ]
    }
  ]
}

CRITICAL RULES:
- DO NOT generate calendar dates. We will compute dates ourselves.
- DO NOT return anything except weekIndex, dayIndex, phase, and plannedData.
- dayIndex MUST be 1-7 (1=Monday, 2=Tuesday, ..., 7=Sunday)
- Each week MUST have exactly 7 days (dayIndex 1 through 7)
- weekIndex starts at 1 (first week is 1, second week is 2, etc.)
- Generate ALL weeks from weekIndex 1 to weekIndex ${inputs.totalWeeks}
- Include rest days appropriately
- Progress mileage gradually
- Match phases to weeks correctly (base ~25%, build ~35%, peak ~20%, taper remaining)
- Return complete plan with all weeks and all days
- DO NOT create adaptive metrics, summaries, or preferred days

Return ONLY the JSON object, nothing else.
```

---

## OpenAI API Configuration

### Model
- **Model:** `gpt-4o-mini` (not gpt-4, not gpt-3.5)
- **Temperature:** `0.7` (moderate creativity)
- **Max Tokens:** `4000` (limit on response size)

### API Call
```typescript
const openai = getOpenAIClient(); // Initializes OpenAI with OPENAI_API_KEY

const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    {
      role: 'system',
      content: 'You are a professional running coach. Generate complete training plans. Always return valid JSON only.',
    },
    {
      role: 'user',
      content: prompt, // Full prompt string (see above)
    },
  ],
  temperature: 0.7,
  max_tokens: 4000,
});
```

### Response Parsing
```typescript
const content = response.choices[0]?.message?.content;
// Clean JSON response (remove markdown code blocks if present)
const cleaned = content.replace(/```json|```/g, '').trim();
const parsed = JSON.parse(cleaned) as GeneratedPlan;
```

---

## Output Structure

### GeneratedPlan Interface
```typescript
export interface GeneratedPlan {
  totalWeeks: number;
  weeks: Week[];
}

export interface Week {
  weekIndex: number;  // 1-based (first week is 1)
  phase: string;      // "base" | "build" | "peak" | "taper"
  days: WeekDay[];
}

export interface WeekDay {
  dayIndex: number;  // 1-7 (1=Monday, 7=Sunday)
  plannedData: {
    type: string;           // "easy" | "tempo" | "intervals" | "long_run" | "rest"
    mileage: number;        // Distance in miles
    paceRange?: string;     // e.g., "8:30-9:00"
    targetPace?: string;    // e.g., "8:00"
    hrZone?: string;         // e.g., "2"
    hrRange?: string;        // e.g., "130-150"
    segments?: Array<{      // For interval workouts
      type: string;
      distance?: number;
      duration?: number;
      pace?: string;
      reps?: number;
    }>;
    label?: string;          // e.g., "Easy Run"
    description?: string;    // e.g., "Comfortable pace, conversational"
    coachNotes?: string;     // Additional guidance
  };
  // NO date field - dates computed by backend
}
```

### Example Output
```json
{
  "totalWeeks": 16,
  "weeks": [
    {
      "weekIndex": 1,
      "phase": "base",
      "days": [
        {
          "dayIndex": 1,
          "plannedData": {
            "type": "easy",
            "mileage": 4,
            "paceRange": "8:30-9:00",
            "hrZone": "2",
            "hrRange": "130-150",
            "label": "Easy Run",
            "description": "Comfortable pace, conversational"
          }
        },
        {
          "dayIndex": 2,
          "plannedData": {
            "type": "rest"
          }
        },
        // ... 5 more days (total 7 days per week)
      ]
    },
    // ... 15 more weeks (total 16 weeks)
  ]
}
```

---

## How Data Is Saved

### Prisma Transaction Flow

All database operations happen in a **single atomic transaction** to ensure data consistency:

```typescript
const result = await prisma.$transaction(async (tx) => {
  // 1. Update TrainingPlan status to "active"
  const updatedPlan = await tx.trainingPlan.update({
    where: { id: trainingPlanId },
    data: {
      status: 'active',
      goalFiveKPace: goalFiveKPace, // Calculated from goal time + race distance
    },
  });

  // 2. Create AthleteTrainingPlan junction entry
  // MVP1: Only created when plan is generated (not during draft creation)
  await tx.athleteTrainingPlan.create({
    data: {
      athleteId,
      trainingPlanId: trainingPlanId,
      assignedAt: new Date(),
    },
  });

  // 3. Create ALL TrainingDayPlanned records with computed dates
  const dayRecords = [];
  for (const week of plan.weeks) {
    for (const day of week.days) {
      // Calculate actual date from plan start date + weekIndex + dayIndex
      const computedDate = calculateTrainingDayDate(
        planStartDate,
        week.weekIndex,
        day.dayIndex
      );
      
      dayRecords.push({
        trainingPlanId: trainingPlanId,
        athleteId,
        weekIndex: week.weekIndex,
        dayIndex: day.dayIndex,
        phase: week.phase,
        date: computedDate,
        plannedData: day.plannedData, // JSON field storing all workout details
      });
    }
  }

  // Batch create all days (single database operation)
  await tx.trainingDayPlanned.createMany({
    data: dayRecords,
  });

  return updatedPlan.id;
});
```

### Date Calculation

**Function:** `calculateTrainingDayDate(planStartDate, weekIndex, dayIndex)`

**Formula:**
```typescript
const daysToAdd = ((weekIndex - 1) * 7) + (dayIndex - 1);
const date = new Date(planStartDate);
date.setDate(date.getDate() + daysToAdd);
```

**Examples:**
- Week 1, Day 1 (Monday) = `planStartDate + 0 days`
- Week 1, Day 2 (Tuesday) = `planStartDate + 1 day`
- Week 2, Day 1 (Monday) = `planStartDate + 7 days`
- Week 2, Day 2 (Tuesday) = `planStartDate + 8 days`

### Database Records Created

1. **TrainingPlan** (updated)
   - `status`: `"draft"` → `"active"`
   - `goalFiveKPace`: Set if not already calculated

2. **AthleteTrainingPlan** (created)
   - Links athlete to training plan
   - `assignedAt`: Current timestamp
   - MVP1: Only created when plan is generated

3. **TrainingDayPlanned** (created - one per day)
   - `trainingPlanId`: FK to TrainingPlan
   - `athleteId`: FK to Athlete
   - `weekIndex`: 1-based week number
   - `dayIndex`: 1-7 (Monday-Sunday)
   - `phase`: "base" | "build" | "peak" | "taper"
   - `date`: Computed actual calendar date
   - `plannedData`: JSON field with workout details

**Total Records:** For a 16-week plan = **112 TrainingDayPlanned records** (16 weeks × 7 days)

---

## Key Design Decisions

### ✅ What Works Well

1. **Atomic Transaction:** All database operations succeed or fail together
2. **Date Computation:** Backend calculates dates, not AI (more reliable)
3. **Complete Generation:** All weeks generated at once (no incremental loading)
4. **Structured Output:** JSON schema enforces consistency
5. **Phase Distribution:** Clear rules for base/build/peak/taper allocation

### ⚠️ Current Limitations

1. **No Error Recovery:** If OpenAI fails, entire transaction fails
2. **No Partial Plans:** Can't generate "just week 1" or regenerate a single week
3. **No Validation:** Doesn't validate AI output before saving (relies on JSON parsing)
4. **Fixed Model:** Hardcoded to `gpt-4o-mini` (no model selection)
5. **No Retry Logic:** Single API call, no retries on failure
6. **No Streaming:** Waits for complete response (could be slow for long plans)
7. **No Caching:** Always calls OpenAI, even for similar inputs
8. **No Versioning:** Can't regenerate plan and keep old version

### 🔄 Refactoring Considerations

#### Potential Improvements

1. **Incremental Generation**
   - Generate one week at a time
   - Allow regeneration of specific weeks
   - Support plan updates mid-cycle

2. **Validation Layer**
   - Validate AI output against schema before saving
   - Check phase distribution matches rules
   - Verify all weeks have 7 days

3. **Error Handling**
   - Retry logic with exponential backoff
   - Partial save on partial failure
   - Better error messages for users

4. **Model Selection**
   - Allow different models for different plan lengths
   - Fallback to cheaper model if primary fails
   - A/B testing different models

5. **Streaming Response**
   - Stream weeks as they're generated
   - Show progress to user
   - Save incrementally

6. **Caching**
   - Cache similar plans (same race + goal time + weeks)
   - Template-based generation for common scenarios
   - Reduce API costs

7. **Versioning**
   - Keep old plan versions when regenerating
   - Allow comparison between versions
   - Support "revert to previous plan"

8. **Prompt Engineering**
   - More detailed phase instructions
   - Race-specific guidance (marathon vs 5K)
   - Athlete experience level consideration
   - Injury prevention guidelines

9. **Post-Processing**
   - Validate mileage progression
   - Check rest day distribution
   - Ensure phase transitions are smooth
   - Add recovery weeks automatically

10. **Testing**
    - Unit tests for date calculation
    - Mock OpenAI responses for testing
    - Integration tests for full flow
    - Load testing for concurrent generations

---

## Environment Variables

### Required
```bash
OPENAI_API_KEY=sk-...  # OpenAI API key for GPT-4o-mini
```

### Where It's Used
- `lib/training/plan-generator.ts` - `getOpenAIClient()` function

---

## Error Handling

### Current Error Cases

1. **Missing API Key**
   ```typescript
   throw new Error('OPENAI_API_KEY environment variable is required');
   ```

2. **No OpenAI Response**
   ```typescript
   if (!content) {
     throw new Error('No response from OpenAI');
   }
   ```

3. **JSON Parse Failure**
   ```typescript
   catch (error) {
     console.error('Error generating training plan:', error);
     throw new Error('Failed to generate training plan');
   }
   ```

4. **Database Transaction Failure**
   - Entire transaction rolls back
   - No partial data saved
   - Error returned to API route

### API Route Error Responses

- **400 Bad Request:** Missing required fields, invalid plan state
- **401 Unauthorized:** Authentication failure
- **403 Forbidden:** Plan doesn't belong to athlete
- **404 Not Found:** Plan or athlete not found
- **500 Internal Server Error:** OpenAI failure, database error

---

## Performance Considerations

### Current Performance

- **API Call Time:** ~5-15 seconds (depends on plan length)
- **Database Write Time:** ~1-2 seconds (112 records for 16-week plan)
- **Total Time:** ~6-17 seconds end-to-end

### Bottlenecks

1. **OpenAI API:** Slowest part (network + processing)
2. **Database Writes:** `createMany` is efficient but still writes 100+ records
3. **No Parallelization:** Sequential operations

### Optimization Opportunities

1. **Batch Processing:** Generate multiple plans concurrently
2. **Async Processing:** Queue generation, notify when complete
3. **Database Optimization:** Use bulk inserts, reduce indexes during insert
4. **Caching:** Cache common plan templates

---

## Testing Strategy

### Unit Tests Needed

```typescript
// Test date calculation
describe('calculateTrainingDayDate', () => {
  it('calculates correct date for week 1, day 1', () => {
    const startDate = new Date('2025-01-01');
    const date = calculateTrainingDayDate(startDate, 1, 1);
    expect(date).toEqual(new Date('2025-01-01'));
  });
  
  it('calculates correct date for week 2, day 1', () => {
    const startDate = new Date('2025-01-01');
    const date = calculateTrainingDayDate(startDate, 2, 1);
    expect(date).toEqual(new Date('2025-01-08'));
  });
});

// Test prompt construction
describe('generateTrainingPlanAI', () => {
  it('includes all required inputs in prompt', () => {
    // Mock OpenAI, check prompt content
  });
  
  it('handles JSON parsing errors', () => {
    // Mock invalid JSON response
  });
});
```

### Integration Tests Needed

```typescript
// Test full flow
describe('POST /api/training-plan/generate', () => {
  it('generates and saves complete plan', async () => {
    // Create draft plan
    // Call generate endpoint
    // Verify all TrainingDayPlanned records created
    // Verify plan status updated
  });
  
  it('rolls back on OpenAI failure', async () => {
    // Mock OpenAI failure
    // Verify no partial data saved
  });
});
```

---

## Related Files

- **API Route:** `app/api/training-plan/generate/route.ts`
- **Service:** `lib/training/plan-generator.ts`
- **Date Utils:** `lib/training/dates.ts`
- **Goal Pace:** `lib/training/goal-pace.ts`
- **Schema:** `prisma/schema.prisma` (TrainingPlan, TrainingDayPlanned models)

---

## Future Enhancements

### Planned Features

1. **Plan Regeneration:** Allow regenerating specific weeks
2. **Plan Comparison:** Compare old vs new plan versions
3. **Custom Phases:** Allow user to adjust phase distribution
4. **Workout Templates:** Pre-built workout library
5. **Adaptive Plans:** Adjust based on execution data

### Research Areas

1. **Fine-Tuned Models:** Train model on GoFast-specific plans
2. **Multi-Model Ensemble:** Combine multiple models for better results
3. **Real-Time Adjustments:** Update plan based on athlete progress
4. **Injury Prevention:** Incorporate injury risk assessment

---

**Last Updated:** 2025-01-XX  
**Status:** Production (MVP1)  
**Next Review:** Before refactoring


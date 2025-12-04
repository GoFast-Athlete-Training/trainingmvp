# OpenAI Service Call Analysis
## Exact Implementation in TrainingMVP

---

## SERVICE LOCATION
**File:** `lib/services/plan-generator.ts`  
**Function:** `generateTrainingPlanAI()`  
**Lines:** 64-170

---

## EXACT OPENAI API CALL

### Initialization (Lines 4-6)
```typescript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

### API Call (Lines 139-154)
```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    {
      role: 'system',
      content: 'You are a professional running coach. Generate complete training plans. Always return valid JSON only.',
    },
    {
      role: 'user',
      content: prompt,  // ← Full prompt string (see below)
    },
  ],
  temperature: 0.7,
  max_tokens: 4000,
});
```

### Parameters:
- **Model:** `gpt-4o-mini` (not gpt-4, not gpt-3.5)
- **Temperature:** `0.7` (moderate creativity)
- **Max Tokens:** `4000` (limit on response size)
- **Messages:** 2-message array (system + user)

---

## EXACT PROMPT SENT TO OPENAI

### System Message:
```
You are a professional running coach. Generate complete training plans. Always return valid JSON only.
```

### User Message (Full Prompt):
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

Calculate weeks until race: [CALCULATED] weeks

Inputs:
- Race: [raceName] ([raceDistance])
- Race Date: [raceDate]
- Goal Time: [goalTime]
- Baseline 5K Pace: [baseline5k] per mile
- Current Weekly Mileage: [weeklyMileage] miles
- Preferred Run Days: [preferredRunDays] or "Not specified"

You must return EXACT JSON ONLY (no markdown, no explanation):
{
  "totalWeeks": 18,
  "phaseOverview": {
    "base": { "startWeek": 0, "endWeek": 4 },
    "build": { "startWeek": 5, "endWeek": 11 },
    "peak": { "startWeek": 12, "endWeek": 15 },
    "taper": { "startWeek": 16, "endWeek": 17 }
  },
  "weeklyMileagePlan": [20, 22, 24, ...],
  "weeks": [
    {
      "weekIndex": 0,
      "phase": "base",
      "days": [
        {
          "dayIndex": 0,
          "plannedData": {
            "type": "easy",
            "mileage": 4,
            "paceRange": "8:30-9:00",
            "hrZone": "2",
            "hrRange": "130-150",
            "label": "Easy Run",
            "description": "Comfortable pace, conversational"
          },
          "date": "2025-02-01"
        }
      ]
    }
  ]
}

Rules:
- Generate ALL weeks from start date to race date
- Each week has 7 days (dayIndex 0-6, Monday-Sunday)
- Calculate dates starting from today or specified start date
- Include rest days appropriately
- Progress mileage gradually
- Match phases to weeks correctly
- Return complete plan with all weeks and days

Return ONLY the JSON object, nothing else.
```

---

## WHAT THE SERVICE ACTUALLY DOES

### Step 1: Build Prompt (Lines 67-136)
- Constructs prompt string with:
  - Phase definitions (percentages)
  - Workout type definitions
  - Calculated weeks until race
  - All input parameters (race, goal, baseline, etc.)
  - Example JSON structure
  - Rules/constraints

### Step 2: Call OpenAI API (Lines 139-154)
- Makes single API call to `gpt-4o-mini`
- Sends system + user messages
- Waits for response

### Step 3: Parse Response (Lines 156-165)
```typescript
const content = response.choices[0]?.message?.content;
if (!content) {
  throw new Error('No response from OpenAI');
}

// Clean JSON response
const cleaned = content.replace(/```json|```/g, '').trim();
const parsed = JSON.parse(cleaned) as GeneratedPlan;

return parsed;
```

**What it does:**
1. Extracts content from first choice
2. Removes markdown code blocks (```json, ```)
3. Parses as JSON
4. Returns typed `GeneratedPlan` object

### Step 4: Error Handling (Lines 166-169)
- Catches errors
- Logs to console
- Throws generic error message

---

## WHAT THE AI IS ASKED TO GENERATE

### Expected Response Structure:
```typescript
{
  totalWeeks: number,              // e.g., 18
  phaseOverview: {                  // Phase boundaries
    base: { startWeek: 0, endWeek: 4 },
    build: { startWeek: 5, endWeek: 11 },
    peak: { startWeek: 12, endWeek: 15 },
    taper: { startWeek: 16, endWeek: 17 }
  },
  weeklyMileagePlan: number[],     // [20, 22, 24, ...] - one per week
  weeks: [                         // Array of all weeks
    {
      weekIndex: number,            // 0, 1, 2, ...
      phase: string,                // "base", "build", "peak", "taper"
      days: [                       // Array of 7 days
        {
          dayIndex: number,         // 0-6 (Monday-Sunday)
          plannedData: {            // Workout details
            type: string,            // "easy", "tempo", "intervals", "long_run", "rest"
            mileage: number,
            paceRange?: string,
            targetPace?: string,
            hrZone?: string,
            hrRange?: string,
            segments?: Array<{...}>,
            label?: string,
            description?: string,
            coachNotes?: string
          },
          date: string              // ISO date string
        }
      ]
    }
  ]
}
```

### Key Constraints:
1. **ALL weeks** must be generated (not incremental)
2. **7 days per week** (dayIndex 0-6)
3. **Dates calculated** from start date
4. **Phases match weeks** (base/build/peak/taper)
5. **Mileage progresses** gradually
6. **JSON only** (no markdown, no explanation)

---

## WHERE THIS FUNCTION IS CALLED

### Current Status: ⚠️ NOT CALLED ANYWHERE

**Search Results:**
- ❌ No API route calls `generateTrainingPlanAI()`
- ❌ No page component calls it
- ❌ No other service calls it

**The function exists but is NOT integrated into the app flow.**

### Expected Usage (Not Implemented):
```typescript
// Should be called after onboarding save
const plan = await generateTrainingPlanAI({
  raceName: athlete.myTargetRace,
  raceDate: race.raceDate,
  raceDistance: race.raceType,
  goalTime: athlete.myTrainingGoal,
  baseline5k: athlete.myCurrentPace,
  weeklyMileage: athlete.myWeeklyMileage || 20,
});

// Then save to DB
const planId = await saveTrainingPlanToDB(athleteId, raceId, plan, inputs);
```

---

## WHAT HAPPENS AFTER AI RESPONSE

### If Function Were Called:

1. **AI Returns:** Complete JSON with all weeks/days
2. **Function Returns:** Parsed `GeneratedPlan` object
3. **Save Function:** `saveTrainingPlanToDB()` would:
   - Create `TrainingPlan` record
   - Loop through `plan.weeks[]`
   - Loop through each `week.days[]`
   - Create `TrainingDayPlanned` record for each day
   - **DISCARD:** `phaseOverview` and `weeklyMileagePlan` (not saved)

### Data Loss:
- `phaseOverview` object → **NOT SAVED**
- `weeklyMileagePlan` array → **NOT SAVED**
- Only individual days with their phase strings are saved

---

## TOKEN USAGE ESTIMATE

### Input Tokens:
- System message: ~20 tokens
- User prompt: ~400-500 tokens (varies with inputs)
- **Total Input:** ~420-520 tokens

### Output Tokens:
- Max allowed: 4000 tokens
- For 18-week plan: ~2000-3000 tokens estimated
- Each week: ~100-150 tokens
- Each day: ~15-20 tokens

### Cost (gpt-4o-mini):
- Input: ~$0.00015 per 1K tokens
- Output: ~$0.0006 per 1K tokens
- **Estimated cost per plan:** $0.002-0.003 (very cheap)

---

## POTENTIAL ISSUES

### 1. Token Limit
- **Max 4000 tokens** may not be enough for long plans (20+ weeks)
- Could truncate response
- No error handling for truncated JSON

### 2. JSON Parsing
- Only removes markdown, doesn't handle:
  - Malformed JSON
  - Missing fields
  - Type mismatches
  - No validation of structure

### 3. Date Calculation
- AI calculates dates, but:
  - No validation dates are correct
  - No check for gaps
  - No validation all 7 days exist per week

### 4. Phase Consistency
- AI assigns phases, but:
  - No validation phases match phaseOverview
  - No check phase percentages are correct
  - Stored phase strings may not match calculated phases

### 5. No Retry Logic
- Single API call
- If it fails, entire generation fails
- No fallback or retry mechanism

---

## SUMMARY

### What the Service Does:
1. ✅ Builds detailed prompt with all inputs
2. ✅ Calls OpenAI `gpt-4o-mini` with temperature 0.7
3. ✅ Requests complete plan (all weeks/days) in one call
4. ✅ Parses JSON response
5. ✅ Returns typed `GeneratedPlan` object

### What It Doesn't Do:
- ❌ Not called anywhere in the app
- ❌ No validation of response structure
- ❌ No error recovery
- ❌ No token limit handling
- ❌ Doesn't save `phaseOverview` or `weeklyMileagePlan`

### Current State:
**The OpenAI service exists and is fully implemented, but it's NOT integrated into the application flow. Plans are NOT being generated automatically after onboarding.**


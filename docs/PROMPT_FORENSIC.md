# Training Plan Generator Prompt Forensic Analysis

## Current State: Mixed Database-Driven + Hardcoded Instructions

### What Comes From Database (TrainingGenPrompt Model)

1. **AI Role Content** (`prompt.aiRole.content`)
   - Loaded from `ai_roles` table
   - Used as the system message base
   - Location: `lib/training/prompt-assembler.ts:40`

2. **Rule Set** (`prompt.ruleSet.topics` and `prompt.ruleSet.topics[].rules`)
   - Loaded from `rule_sets` → `rule_set_topics` → `rule_set_rules` tables
   - Builds the user prompt section
   - Location: `lib/training/prompt-assembler.ts:45-54`

3. **Return Format Schema** (`prompt.returnFormat.schema`)
   - Loaded from `return_json_formats` table
   - Used for JSON structure validation
   - Location: `lib/training/prompt-assembler.ts:61`

4. **Must Haves Fields** (`prompt.mustHaves.fields`)
   - Loaded from `must_haves` table
   - Used for input requirements
   - Location: `lib/training/prompt-assembler.ts:64`

### What's Hardcoded (NOT in Database)

#### 1. System Message Append (Line 510-511 in `plan-generator.ts`)
```typescript
const systemMessage = assembledPrompt.systemMessage + 
  '\n\nCRITICAL: You MUST return phases (with name and weekCount) AND a "weeks" array containing ALL weeks (1 through totalWeeks). Each week must have weekNumber and days array. DO NOT include "weeks" array inside phases. Return ONLY valid JSON matching the return format schema provided.';
```

**Problem**: This critical instruction about generating ALL weeks is hardcoded and not stored in the database model.

#### 2. JSON Structure Example (Lines 471-503 in `plan-generator.ts`)
```typescript
CRITICAL: The JSON structure must be EXACTLY this format (no variations):
{
  "totalWeeks": ${inputs.totalWeeks},
  "phases": [...],
  "weeks": [
    {
      "weekNumber": 1,
      "days": [...]
    },
    {
      "weekNumber": 2,
      "days": [...]
    }
    // ... continue for ALL ${inputs.totalWeeks} weeks
  ]
}
NOTE: You MUST generate ALL ${inputs.totalWeeks} weeks in the "weeks" array...
```

**Problem**: The example JSON structure showing the `weeks` array format is hardcoded in the prompt builder, not coming from the return format schema or database.

#### 3. Input Section Template (Lines 134-148 in `prompt-assembler.ts`)
```typescript
const inputSection = `
Inputs:
- Race: ${inputs.raceName} (${inputs.raceDistance})
- Goal Time: ${inputs.goalTime}
- Athlete current 5K pace: ${inputs.fiveKPace} per mile (baseline fitness)
...
`;
```

**Problem**: The input formatting template is hardcoded, not configurable via database.

#### 4. Return Format Instructions (Lines 151-154 in `prompt-assembler.ts`)
```typescript
const returnFormatSection = `
You must return EXACT JSON ONLY (no markdown, no explanation) matching this structure:
${JSON.stringify(returnFormatSchema, null, 2)}
`;
```

**Problem**: The instruction text "You must return EXACT JSON ONLY..." is hardcoded, even though it uses the schema from the database.

## The Issue: Why "Leftover Crap" Exists

The current architecture has:
- ✅ Database-driven: AI Role, Rule Set, Return Format Schema, Must Haves
- ❌ Hardcoded: Critical instructions about weeks array, JSON structure examples, input formatting, return format instructions

**Root Cause**: The `TrainingGenPrompt` model doesn't have an `instructions` field to store:
- Critical system message appendices (like "generate ALL weeks")
- JSON structure examples
- Formatting instructions

## Where Clarity Was Missing

1. **Line 510-511**: Hardcoded instruction about generating ALL weeks - this should be in the database
2. **Lines 471-503**: Hardcoded JSON structure example - should reference or be derived from return format schema
3. **Lines 134-148**: Hardcoded input section template - could be in Rule Set or a separate template field
4. **Lines 151-154**: Hardcoded return format instruction text - could be in Return Format model

## Recommendation

To fully database-drive the prompt generation, the `TrainingGenPrompt` model would need:
- `instructions` field (String?) - for critical system message appendices
- Or, these instructions could be added to the `AIRole.content` in the database
- Or, the JSON structure example could be generated from the `returnFormat.schema` instead of hardcoded

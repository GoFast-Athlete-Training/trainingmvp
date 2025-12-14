import OpenAI from 'openai';
import { TRAINING_PHASE_ORDER, validatePhaseOrder } from '@/config/training-phases';
import { loadAndAssemblePrompt, buildTrainingPlanPrompt } from './prompt-assembler';

/**
 * Validate generated plan against Return Format schema
 */
function validateAgainstReturnFormat(plan: GeneratedPlan, schema: any): void {
  // Basic structure validation
  if (schema.type === 'object') {
    const requiredFields = schema.required || [];
    
    // Check required top-level fields
    for (const field of requiredFields) {
      if (!(field in plan)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate properties match schema
    if (schema.properties) {
      // Check totalWeeks
      if (schema.properties.totalWeeks && typeof plan.totalWeeks !== schema.properties.totalWeeks.type) {
        throw new Error(`totalWeeks must be ${schema.properties.totalWeeks.type}, got ${typeof plan.totalWeeks}`);
      }

      // Check phases array
      if (schema.properties.phases) {
        if (!Array.isArray(plan.phases)) {
          throw new Error('phases must be an array');
        }
        // Validate each phase matches phase schema
        if (schema.properties.phases.items) {
          for (const phase of plan.phases) {
            const phaseSchema = schema.properties.phases.items.properties || {};
            if (phaseSchema.name && typeof phase.name !== phaseSchema.name.type) {
              throw new Error(`Phase name must be ${phaseSchema.name.type}`);
            }
            if (phaseSchema.weekCount && typeof phase.weekCount !== phaseSchema.weekCount.type) {
              throw new Error(`Phase weekCount must be ${phaseSchema.weekCount.type}`);
            }
          }
        }
      }

      // Check week object
      if (schema.properties.week) {
        if (!plan.week) {
          throw new Error('Missing required field: week');
        }
        const weekSchema = schema.properties.week.properties || {};
        if (weekSchema.weekNumber && typeof plan.week.weekNumber !== weekSchema.weekNumber.type) {
          throw new Error(`week.weekNumber must be ${weekSchema.weekNumber.type}`);
        }
        if (weekSchema.days) {
          if (!Array.isArray(plan.week.days)) {
            throw new Error('week.days must be an array');
          }
        }
      }
    }
  }
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export interface TrainingInputs {
  promptId: string; // TrainingGenPrompt ID - required for database-driven generation
  raceName: string;
  raceDistance: string; // raceType string (marathon, half, etc.) for display
  raceMiles?: number; // Optional: miles for accurate calculations
  goalTime: string;
  fiveKPace: string; // mm:ss format - from athlete.fiveKPace (current fitness)
  predictedRacePace: string; // mm:ss format - predicted race pace based on 5K fitness
  goalRacePace: string; // mm:ss format - goal race pace from goal time
  currentWeeklyMileage: number; // Baseline weekly mileage - start here and build up gradually
  preferredDays: number[]; // Preferred training days (1=Monday, 7=Sunday)
  totalWeeks: number; // Calculated externally
  planStartDate: Date; // Actual start date - used to determine day of week patterns
}

// Lap format: stored in warmup/workout/cooldown JSON arrays
export interface TrainingPlanLap {
  lapIndex: number; // Sequential within warmup/workout/cooldown (1-based, must increment)
  distanceMiles: number; // 0.25, 1.0, etc (must be > 0)
  paceGoal: string | null; // "7:20" or null (mm:ss format)
  hrGoal?: string | null; // "Z2", "Z3", "Z4", "Z5" or null (optional heart rate zone)
}

// Day: belongs to week, contains structured workout
export interface TrainingPlanDay {
  dayNumber: number; // 1-7 (1=Monday, 7=Sunday)
  warmup: TrainingPlanLap[]; // Lap array
  workout: TrainingPlanLap[]; // Lap array
  cooldown: TrainingPlanLap[]; // Lap array
  notes?: string;
}

// Week: belongs to phase, contains days
export interface TrainingPlanWeek {
  weekNumber: number; // Global week 1-N (within entire plan)
  days: TrainingPlanDay[]; // Exactly 7 days
}

// Phase: Base / Build / Peak / Taper
export interface TrainingPlanPhase {
  name: string; // "base" | "build" | "peak" | "taper"
  weekCount: number; // How many weeks in this phase
  totalMiles?: number; // Optional - computed later
  weeks?: TrainingPlanWeek[]; // Optional - only included in initial generation for week 1
}

// Generated Plan: Initial generation returns phases + week 1 only
export interface GeneratedPlan {
  totalWeeks: number;
  phases: TrainingPlanPhase[]; // phases[] with weekCount only (no weeks array)
  week: TrainingPlanWeek; // Week 1 only
  weeks?: TrainingPlanWeek[]; // Optional: All weeks if AI generates them
}

// Weekly Generation Inputs (for generating subsequent weeks)
export interface WeeklyGenerationInputs {
  trainingPlanId: string;
  weekNumber: number; // Which week to generate (2, 3, 4, etc.)
  phaseName: string; // Which phase this week belongs to
  previousWeekMileage?: number; // Total miles from previous week (for progression)
  previousWeekExecution?: {
    completedDays: number;
    totalMiles: number;
    averagePace?: string;
    notes?: string;
  }; // Execution data from previous week (for adaptive training)
  raceName: string;
  raceDistance: string;
  goalTime: string;
  fiveKPace: string;
  predictedRacePace: string;
  goalRacePace: string;
  currentWeeklyMileage: number; // Baseline
  preferredDays: number[];
  planStartDate: Date;
}

// Generated Week: Single week structure
export interface GeneratedWeek {
  weekNumber: number;
  days: TrainingPlanDay[]; // Exactly 7 days
}

/**
 * Generate a complete training plan using OpenAI
 * Uses database-driven TrainingGenPrompt for prompt assembly
 * Creates phases + Week 1 only (progressive generation)
 */
export async function generateTrainingPlanAI(
  inputs: TrainingInputs
): Promise<GeneratedPlan> {
  // Load prompt configuration from database
  console.log('📋 PLAN GENERATOR: Loading prompt configuration from database...', {
    promptId: inputs.promptId,
  });

  const assembledPrompt = await loadAndAssemblePrompt(inputs.promptId);
  
  console.log('✅ PLAN GENERATOR: Prompt loaded from database', {
    hasSystemMessage: !!assembledPrompt.systemMessage,
    systemMessageLength: assembledPrompt.systemMessage?.length || 0,
    hasUserPrompt: !!assembledPrompt.userPrompt,
    userPromptLength: assembledPrompt.userPrompt?.length || 0,
    hasReturnFormatSchema: !!assembledPrompt.returnFormatSchema,
    hasReturnFormatExample: !!assembledPrompt.returnFormatExample,
    instructionsCount: assembledPrompt.instructions?.length || 0,
    hasMustHaves: !!assembledPrompt.mustHaveFields,
  });
  
  // Log instructions being used
  if (assembledPrompt.instructions && assembledPrompt.instructions.length > 0) {
    console.log('📋 PLAN GENERATOR: Using instructions from database:', 
      assembledPrompt.instructions.map(inst => `"${inst.title}"`).join(', ')
    );
  }
  
  // Log return format being used
  if (assembledPrompt.returnFormatExample) {
    console.log('📋 PLAN GENERATOR: Using return format EXAMPLE from database (complete JSON)');
  } else {
    console.log('⚠️ PLAN GENERATOR: No return format example found, using schema only');
  }

  // Determine day of week the plan starts on
  const today = new Date();
  const todayDateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const startDate = new Date(inputs.planStartDate);
  const startDateStr = startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const startDayOfWeek = startDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const startDayName = dayNames[startDayOfWeek];
  
  // Convert to our 1-7 system (1=Monday, 7=Sunday)
  const startDayNumber = startDayOfWeek === 0 ? 7 : startDayOfWeek;
  
  // Calculate how many days are left in the week (for partial first week)
  const daysRemainingInWeek = 8 - startDayNumber;
  
  // Build list of dayNumbers to generate for Week 1
  const week1DayNumbers: number[] = [];
  for (let i = startDayNumber; i <= 7; i++) {
    week1DayNumbers.push(i);
  }

  // Build the complete prompt dynamically from database records
  const userPrompt = buildTrainingPlanPrompt(assembledPrompt, {
    raceName: inputs.raceName,
    raceDistance: inputs.raceDistance,
    goalTime: inputs.goalTime,
    fiveKPace: inputs.fiveKPace,
    predictedRacePace: inputs.predictedRacePace,
    goalRacePace: inputs.goalRacePace,
    currentWeeklyMileage: inputs.currentWeeklyMileage,
    preferredDays: inputs.preferredDays,
    totalWeeks: inputs.totalWeeks,
    planStartDate: inputs.planStartDate,
  });
  
  // Use database-driven prompt only - no hardcoded instructions
  // userPrompt already includes: inputs, ruleSet content, and return format section
  const prompt = userPrompt;

  try {
    const openai = getOpenAIClient();
    
    // Use database-driven system message only (AI Role content + Prompt Instructions)
    // All execution guardrails come from PromptInstruction records in database
    const systemMessage = assembledPrompt.systemMessage;

    console.log('🤖 PLAN GENERATOR: Calling OpenAI with fully database-driven prompt');
    console.log('📊 PLAN GENERATOR: System message length:', systemMessage.length);
    console.log('📊 PLAN GENERATOR: User prompt length:', prompt.length);
    console.log('📊 PLAN GENERATOR: System message preview:', systemMessage.substring(0, 200) + '...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemMessage, // AI Role + Instructions (all from database)
        },
        {
          role: 'user',
          content: prompt, // Inputs + Rule Set + Return Format Example (all from database)
        },
      ],
      temperature: 0.7,
      max_tokens: 2000, // Reduced since we only generate phases + week 1 now
      response_format: { type: 'json_object' }, // Force JSON mode
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Clean JSON response - remove markdown code blocks
    let cleaned = content.replace(/```json|```/g, '').trim();
    
    // Try to extract JSON if it's wrapped in other text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    // Fix common JSON issues
    // Remove trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    
    // Try to parse JSON with better error handling
    let parsed: GeneratedPlan;
    try {
      parsed = JSON.parse(cleaned) as GeneratedPlan;
    } catch (parseError: any) {
      console.error('❌ JSON Parse Error:', parseError.message);
      console.error('❌ JSON Position:', parseError.message.match(/position (\d+)/)?.[1]);
      console.error('❌ JSON Content (first 500 chars):', cleaned.substring(0, 500));
      console.error('❌ JSON Content (around error):', cleaned.substring(Math.max(0, (parseError.message.match(/position (\d+)/)?.[1] || 0) - 100), (parseError.message.match(/position (\d+)/)?.[1] || 0) + 100));
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}. This usually means the AI returned malformed JSON. Please try again.`);
    }

    // Validate structure matches Return Format schema
    if (!parsed.phases || !Array.isArray(parsed.phases)) {
      throw new Error('Invalid plan structure: missing phases array');
    }

    // Validate against Return Format schema from database
    console.log('🔍 PLAN GENERATOR: Validating response against Return Format schema...');
    try {
      validateAgainstReturnFormat(parsed, assembledPrompt.returnFormatSchema);
      console.log('✅ PLAN GENERATOR: Response matches Return Format schema');
    } catch (validationError: any) {
      console.error('❌ PLAN GENERATOR: Return Format validation failed:', validationError.message);
      throw new Error(`Response does not match Return Format schema: ${validationError.message}`);
    }

    // Clean up phases - remove any "weeks" arrays if AI included them (should only have weekCount)
    for (const phase of parsed.phases) {
      if ('weeks' in phase) {
        console.warn('⚠️ AI included weeks array in phase, removing it. Phase should only have name and weekCount.');
        // Try to extract week 1 if it exists in the weeks array
        if (Array.isArray(phase.weeks) && phase.weeks.length > 0 && !parsed.week) {
          const week1 = phase.weeks.find((w: any) => w.weekNumber === 1);
          if (week1) {
            parsed.week = week1;
            console.log('✅ Extracted week 1 from phase.weeks array');
          }
        }
        delete phase.weeks;
      }
      // Ensure only name and weekCount exist
      const cleanedPhase = {
        name: phase.name,
        weekCount: phase.weekCount,
      };
      Object.assign(phase, cleanedPhase);
    }

    // If still no week, try to find it in any phase's weeks array (fallback)
    if (!parsed.week) {
      for (const phase of parsed.phases as any[]) {
        if (phase.weeks && Array.isArray(phase.weeks)) {
          const week1 = phase.weeks.find((w: any) => w.weekNumber === 1);
          if (week1) {
            parsed.week = week1;
            console.log('✅ Found week 1 in phase weeks array (fallback)');
            break;
          }
        }
      }
    }

    if (!parsed.week || !parsed.week.weekNumber || parsed.week.weekNumber !== 1) {
      throw new Error('Invalid plan structure: missing or invalid week 1. AI must return week 1 with weekNumber: 1');
    }

    // Validate phase order (CRITICAL)
    if (!validatePhaseOrder(parsed.phases)) {
      throw new Error(
        `Invalid phase order. Phases must be in this exact order: ${TRAINING_PHASE_ORDER.join(', ')}. ` +
        `Received: ${parsed.phases.map(p => p.name).join(', ')}`
      );
    }

    // Validate phase structure (phases should only have name and weekCount, no weeks array)
    for (const phase of parsed.phases) {
      if (!phase.name || typeof phase.weekCount !== 'number') {
        throw new Error(`Invalid phase structure: ${JSON.stringify(phase)}. Must have name and weekCount only.`);
      }
      // Validate phase name is one of the allowed phases
      if (!TRAINING_PHASE_ORDER.includes(phase.name as any)) {
        throw new Error(`Invalid phase name: ${phase.name}. Must be one of: ${TRAINING_PHASE_ORDER.join(', ')}`);
      }
    }

    // Validate week 1 structure (may be partial week)
    const week = parsed.week;
    if (!week.days || !Array.isArray(week.days)) {
      throw new Error(`Invalid week structure: missing days array`);
    }
    // Week 1 may be partial (not always 7 days) - validate against expected days
    const expectedDayCount = daysRemainingInWeek;
    if (week.days.length !== expectedDayCount) {
      throw new Error(`Week 1 must have exactly ${expectedDayCount} days (starting on ${startDayName}, dayNumber ${startDayNumber}), got ${week.days.length}`);
    }
    // Validate that dayNumbers match expected range
    const expectedDayNumbers = week1DayNumbers;
    const actualDayNumbers = week.days.map((d: any) => d.dayNumber).sort((a: number, b: number) => a - b);
    if (JSON.stringify(actualDayNumbers) !== JSON.stringify(expectedDayNumbers)) {
      throw new Error(`Week 1 dayNumbers must be [${expectedDayNumbers.join(', ')}] (starting on ${startDayName}), got [${actualDayNumbers.join(', ')}]`);
    }
    for (const day of week.days) {
      if (!day.dayNumber || day.dayNumber < 1 || day.dayNumber > 7) {
        throw new Error(`Invalid dayNumber: ${day.dayNumber}. Must be 1-7 (Monday-Sunday)`);
      }
      if (!day.warmup || !day.workout || !day.cooldown) {
        throw new Error(`Invalid day structure: missing warmup/workout/cooldown arrays`);
      }
      // Validate lap structure
      [...day.warmup, ...day.workout, ...day.cooldown].forEach((lap) => {
        if (!lap.lapIndex || typeof lap.lapIndex !== 'number') {
          throw new Error(`Invalid lap structure: lapIndex must be a number`);
        }
        if (!lap.distanceMiles || typeof lap.distanceMiles !== 'number') {
          throw new Error(`Invalid lap structure: distanceMiles must be a number`);
        }
        if (lap.paceGoal !== null && typeof lap.paceGoal !== 'string') {
          throw new Error(`Invalid lap structure: paceGoal must be string or null`);
        }
      });
    }

    console.log('✅ PLAN GENERATOR: Successfully parsed and validated plan:', {
      phasesCount: parsed.phases.length,
      hasWeek: !!parsed.week,
      weekDays: parsed.week?.days?.length,
    });

    return parsed;
  } catch (error: any) {
    console.error('❌ PLAN GENERATOR: Error generating training plan:', error);
    // Preserve original error message
    if (error.message) {
      throw error;
    }
    throw new Error(`Failed to generate training plan: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Generate a single week of training using OpenAI
 * Used for progressive weekly generation (week 2, 3, 4, etc.)
 */
export async function generateWeekAI(
  inputs: WeeklyGenerationInputs
): Promise<GeneratedWeek> {
  const startDate = new Date(inputs.planStartDate);
  const startDayOfWeek = startDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const startDayName = dayNames[startDayOfWeek];
  const startDayNumber = startDayOfWeek === 0 ? 7 : startDayOfWeek;

  // Build context about previous week if available
  let previousWeekContext = '';
  if (inputs.previousWeekExecution) {
    previousWeekContext = `
Previous Week Execution Summary:
- Completed Days: ${inputs.previousWeekExecution.completedDays}/7
- Total Miles: ${inputs.previousWeekExecution.totalMiles} miles
${inputs.previousWeekExecution.averagePace ? `- Average Pace: ${inputs.previousWeekExecution.averagePace}/mile` : ''}
${inputs.previousWeekExecution.notes ? `- Notes: ${inputs.previousWeekExecution.notes}` : ''}
`;
  }

  const prompt = `You are a professional running coach generating Week ${inputs.weekNumber} of a training plan.

Training Plan Context:
- Race: ${inputs.raceName} (${inputs.raceDistance})
- Goal Time: ${inputs.goalTime}
- Current Phase: ${inputs.phaseName}
- Athlete current 5K pace: ${inputs.fiveKPace} per mile
- Predicted race pace: ${inputs.predictedRacePace} per mile
- Goal race pace: ${inputs.goalRacePace} per mile
- Baseline weekly mileage: ${inputs.currentWeeklyMileage} miles/week
- Preferred training days: ${inputs.preferredDays.map(d => {
    const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return dayNames[d];
  }).join(', ')} (dayNumbers: ${inputs.preferredDays.join(', ')})
${previousWeekContext}
Week Requirements:
- Generate ONLY Week ${inputs.weekNumber} (7 days)
- Week MUST have exactly 7 days (dayNumber 1-7, Monday-Sunday)
- Progress mileage appropriately from previous week
${inputs.previousWeekMileage ? `- Previous week mileage: ${inputs.previousWeekMileage} miles` : ''}
- Follow phase-appropriate training for ${inputs.phaseName} phase
- Prioritize workouts on preferred days: ${inputs.preferredDays.join(', ')}

Day Structure:
- Each day MUST have "dayNumber" (1-7), "warmup", "workout", "cooldown" arrays
- Each lap MUST have: lapIndex (number), distanceMiles (number), paceGoal (string | null)

Return ONLY this JSON structure:
{
  "weekNumber": ${inputs.weekNumber},
  "days": [
    { "dayNumber": 1, "warmup": [...], "workout": [...], "cooldown": [...] },
    ... (7 days total)
  ]
}`;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional running coach. Generate single weeks of training plans. Always return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000, // Single week is much smaller
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Clean JSON response
    let cleaned = content.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    let parsed: GeneratedWeek;
    try {
      parsed = JSON.parse(cleaned) as GeneratedWeek;
    } catch (parseError: any) {
      console.error('❌ WEEK JSON Parse Error:', parseError.message);
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }

    // Validate week structure
    if (parsed.weekNumber !== inputs.weekNumber) {
      throw new Error(`Week number mismatch: expected ${inputs.weekNumber}, got ${parsed.weekNumber}`);
    }
    if (!parsed.days || !Array.isArray(parsed.days) || parsed.days.length !== 7) {
      throw new Error(`Week ${inputs.weekNumber} must have exactly 7 days, got ${parsed.days?.length || 0}`);
    }

    // Validate each day
    for (const day of parsed.days) {
      if (!day.dayNumber || day.dayNumber < 1 || day.dayNumber > 7) {
        throw new Error(`Invalid dayNumber: ${day.dayNumber}. Must be 1-7`);
      }
      if (!day.warmup || !day.workout || !day.cooldown) {
        throw new Error(`Invalid day structure: missing warmup/workout/cooldown arrays`);
      }
    }

    return parsed;
  } catch (error) {
    console.error(`Error generating week ${inputs.weekNumber}:`, error);
    throw error;
  }
}



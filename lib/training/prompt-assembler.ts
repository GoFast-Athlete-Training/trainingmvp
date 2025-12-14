import { prisma } from '@/lib/prisma';

export interface AssembledPrompt {
  systemMessage: string;
  userPrompt: string;
  returnFormatSchema: any;
  mustHaveFields: Record<string, string>;
}

/**
 * Load TrainingGenPrompt with all relations and assemble the OpenAI prompt
 */
export async function loadAndAssemblePrompt(promptId: string): Promise<AssembledPrompt> {
  const prompt = await prisma.trainingGenPrompt.findUnique({
    where: { id: promptId },
    include: {
      aiRole: true,
      ruleSet: {
        include: {
          topics: {
            include: {
              rules: {
                orderBy: { createdAt: 'asc' },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
      mustHaves: true,
      returnFormat: true,
    },
  });

  if (!prompt) {
    throw new Error(`TrainingGenPrompt with id ${promptId} not found`);
  }

  // System message = AI Role content
  const systemMessage = prompt.aiRole.content;

  // Build user prompt from Rule Set topics and rules
  let userPrompt = '';
  
  if (prompt.ruleSet && prompt.ruleSet.topics && prompt.ruleSet.topics.length > 0) {
    // Group rules by topic
    for (const topic of prompt.ruleSet.topics) {
      userPrompt += `\n\n=== ${topic.name} ===\n`;
      if (topic.rules && topic.rules.length > 0) {
        for (const rule of topic.rules) {
          userPrompt += `${rule.text}\n`;
        }
      }
    }
  } else {
    // If no rule set, provide basic instructions
    userPrompt = 'Generate a training plan based on the provided inputs.';
  }

  // Return Format schema for validation
  const returnFormatSchema = prompt.returnFormat.schema as any;

  // Must Haves fields (input requirements)
  const mustHaveFields = prompt.mustHaves.fields as Record<string, string>;

  return {
    systemMessage,
    userPrompt,
    returnFormatSchema,
    mustHaveFields,
  };
}

/**
 * Build the complete OpenAI prompt by injecting training inputs into the template
 */
export function buildTrainingPlanPrompt(
  assembledPrompt: AssembledPrompt,
  inputs: {
    raceName: string;
    raceDistance: string;
    goalTime: string;
    fiveKPace: string;
    predictedRacePace: string;
    goalRacePace: string;
    currentWeeklyMileage: number;
    preferredDays: number[];
    totalWeeks: number;
    planStartDate: Date;
  }
): string {
  const { systemMessage, userPrompt, returnFormatSchema } = assembledPrompt;

  // Format dates
  const startDate = new Date(inputs.planStartDate);
  const startDayOfWeek = startDate.getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const startDayName = dayNames[startDayOfWeek];
  const startDayNumber = startDayOfWeek === 0 ? 7 : startDayOfWeek;
  
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
  const todayDay = String(today.getDate()).padStart(2, '0');
  const todayDateStr = `${todayMonth}/${todayDay}/${todayYear}`;
  
  const startYear = startDate.getFullYear();
  const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
  const startDay = String(startDate.getDate()).padStart(2, '0');
  const startDateStr = `${startMonth}/${startDay}/${startYear}`;

  // Calculate days remaining in first week
  const daysRemainingInWeek = 8 - startDayNumber;
  const week1DayNumbers: number[] = [];
  for (let i = startDayNumber; i <= 7; i++) {
    week1DayNumbers.push(i);
  }
  const week1DayNames = week1DayNumbers.map(d => {
    const names = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return names[d];
  }).join(', ');

  // Build input section
  const preferredDaysNames = inputs.preferredDays.map(d => {
    const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return dayNames[d];
  }).join(', ');

  // Inject inputs into the rule-based prompt
  let finalPrompt = userPrompt;

  // Replace input placeholders if they exist in the prompt template
  // Otherwise, prepend input information
  const inputSection = `
Inputs:
- Race: ${inputs.raceName} (${inputs.raceDistance})
- Goal Time: ${inputs.goalTime}
- Athlete current 5K pace: ${inputs.fiveKPace} per mile (baseline fitness)
- Predicted race pace (based on fitness): ${inputs.predictedRacePace} per mile (realistic pace today)
- Goal race pace (target for race day): ${inputs.goalRacePace} per mile (training target)
- Current Weekly Mileage: ${inputs.currentWeeklyMileage} miles/week (BASELINE - start here and build up gradually)
- Total Weeks: ${inputs.totalWeeks}
- Plan Start Date: ${startDateStr} (${startDayName}, dayNumber ${startDayNumber})
- Preferred Training Days: ${preferredDaysNames} (dayNumbers: ${inputs.preferredDays.join(', ')})
- Today's Date: ${todayDateStr}
- Week 1 must have exactly ${daysRemainingInWeek} days (dayNumbers: ${week1DayNumbers.join(', ')}) because plan starts on ${startDayName}
- Week 1 should target approximately ${Math.round(inputs.currentWeeklyMileage * (daysRemainingInWeek / 7))} miles (proportional to ${daysRemainingInWeek} days remaining in week)
`;

  // Add return format instructions
  const returnFormatSection = `
You must return EXACT JSON ONLY (no markdown, no explanation) matching this structure:
${JSON.stringify(returnFormatSchema, null, 2)}
`;

  finalPrompt = inputSection + '\n' + finalPrompt + '\n' + returnFormatSection;

  return finalPrompt;
}

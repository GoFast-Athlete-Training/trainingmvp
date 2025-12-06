import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import get from 'lodash/get';

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * Resolve MustHaves paths from training plan data
 * @param mustHaves MustHaves object with fields JSON
 * @param planData Training plan data object
 * @returns Resolved must-haves object
 */
function resolveMustHaves(mustHaves: any, planData: any): Record<string, any> {
  if (!mustHaves || !mustHaves.fields) {
    return {};
  }

  const resolved: Record<string, any> = {};
  const paths = mustHaves.fields as Record<string, string>;

  for (const [key, path] of Object.entries(paths)) {
    try {
      const value = get(planData, path);
      resolved[key] = value;
    } catch (error) {
      console.warn(`Failed to resolve path ${path} for key ${key}:`, error);
      resolved[key] = null;
    }
  }

  return resolved;
}

/**
 * Build full GPT prompt from prompt configuration
 */
function buildPrompt(
  aiRole: any,
  ruleSet: any,
  mustHaves: any,
  returnFormat: any,
  planData: any
): string {
  let prompt = '';

  // Add AI Role system directive
  if (aiRole?.content) {
    prompt += `${aiRole.content}\n\n`;
  }

  // Add rule set
  if (ruleSet?.rules) {
    const rules = typeof ruleSet.rules === 'string' ? ruleSet.rules : JSON.stringify(ruleSet.rules, null, 2);
    prompt += `RULES:\n${rules}\n\n`;
  }

  // Add resolved must-haves
  if (mustHaves) {
    const resolved = resolveMustHaves(mustHaves, planData);
    if (Object.keys(resolved).length > 0) {
      prompt += `REQUIRED INPUTS:\n${JSON.stringify(resolved, null, 2)}\n\n`;
    }
  }

  // Add return format schema
  if (returnFormat?.schema) {
    const schema = typeof returnFormat.schema === 'string' 
      ? returnFormat.schema 
      : JSON.stringify(returnFormat.schema, null, 2);
    prompt += `RETURN FORMAT:\n${schema}\n\n`;
  }

  prompt += 'Return ONLY valid JSON matching the return format. Do not include any markdown or explanation.';

  return prompt;
}

/**
 * Run training plan generator with custom prompt configuration
 * @param trainingPlanId Training plan ID
 * @param promptId TrainingGenPrompt ID
 * @returns Raw JSON result from GPT
 */
export async function runTrainingPlanGenerator(
  trainingPlanId: string,
  promptId: string
): Promise<any> {
  // 1. Load trainingGenPrompt with all relations
  const prompt = await prisma.trainingGenPrompt.findUnique({
    where: { id: promptId },
    include: {
      aiRole: true,
      ruleSet: true,
      mustHaves: true,
      returnFormat: true,
    },
  });

  if (!prompt) {
    throw new Error('Training prompt not found');
  }

  // 2. Load trainingPlan with athlete + race
  const plan = await prisma.trainingPlan.findUnique({
    where: { id: trainingPlanId },
    include: {
      athlete: {
        select: {
          id: true,
          fiveKPace: true,
        },
      },
      race: true,
    },
  });

  if (!plan) {
    throw new Error('Training plan not found');
  }

  // Build plan data object for must-haves resolution
  const planData = {
    plan: {
      id: plan.id,
      name: plan.name,
      goalTime: plan.goalTime,
      goalRacePace: plan.goalRacePace,
      predictedRacePace: plan.predictedRacePace,
      current5KPace: plan.current5KPace,
      currentWeeklyMileage: plan.currentWeeklyMileage,
      preferredDays: plan.preferredDays,
      startDate: plan.startDate,
      totalWeeks: plan.totalWeeks,
    },
    athlete: {
      id: plan.athlete.id,
      fiveKPace: plan.athlete.fiveKPace,
    },
    race: plan.race
      ? {
          id: plan.race.id,
          name: plan.race.name,
          raceType: plan.race.raceType,
          miles: plan.race.miles,
          date: plan.race.date,
        }
      : null,
  };

  // 3. Build full GPT prompt
  const fullPrompt = buildPrompt(
    prompt.aiRole,
    prompt.ruleSet,
    prompt.mustHaves,
    prompt.returnFormat,
    planData
  );

  // 4. Call OpenAI
  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: prompt.aiRole?.content || 'You are a professional running coach. Generate training plans. Always return valid JSON only.',
      },
      {
        role: 'user',
        content: fullPrompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  // 5. Parse and return JSON
  let cleaned = content.replace(/```json|```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  try {
    return JSON.parse(cleaned);
  } catch (error: any) {
    throw new Error(`Failed to parse JSON response: ${error.message}`);
  }
}


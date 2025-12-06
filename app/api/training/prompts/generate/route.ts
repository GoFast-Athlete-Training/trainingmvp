export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { runTrainingPlanGenerator } from '@/lib/training/promptEngine';

/**
 * POST /api/training/prompts/generate
 * Run plan generator with custom prompt
 * Body: { trainingPlanId, promptId }
 */
export async function POST(request: NextRequest) {
  try {
    await getAthleteIdFromRequest(request); // Auth check
    const body = await request.json();
    const { trainingPlanId, promptId } = body;

    if (!trainingPlanId || !promptId) {
      return NextResponse.json(
        { success: false, error: 'trainingPlanId and promptId are required' },
        { status: 400 }
      );
    }

    const result = await runTrainingPlanGenerator(trainingPlanId, promptId);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('❌ GENERATE WITH PROMPT: Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate', details: error?.message },
      { status: 500 }
    );
  }
}


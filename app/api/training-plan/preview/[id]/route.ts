export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { getPreview } from '@/lib/redis';

/**
 * Get preview from Redis
 * GET /api/training-plan/preview/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const { id: trainingPlanId } = await params;

    // Verify plan exists and belongs to athlete
    const plan = await prisma.training_plans.findFirst({
      where: {
        id: trainingPlanId,
        athleteId,
      },
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Training plan not found' },
        { status: 404 }
      );
    }

    // Get preview from Redis
    console.log(`🔍 GET PREVIEW: Looking for preview for plan ${trainingPlanId}`);
    const preview = await getPreview(trainingPlanId);
    console.log(`📋 GET PREVIEW: Preview result:`, preview ? 'found' : 'not found');

    if (!preview) {
      console.error(`❌ GET PREVIEW: No preview found for plan ${trainingPlanId}`);
      return NextResponse.json(
        { success: false, error: 'Preview not found. Please generate a new preview.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      preview,
    });
  } catch (error: any) {
    console.error('❌ GET PREVIEW: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get preview', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';

/**
 * MVP1 Training Setup Save
 * Saves raceRegistryId + goalTime
 * Does NOT create a plan (that's done via /api/training-plan/generate)
 */
export async function POST(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const body = await request.json();

    const { raceRegistryId, goalTime } = body;

    if (!raceRegistryId || !goalTime) {
      return NextResponse.json(
        { success: false, error: 'raceRegistryId and goalTime are required' },
        { status: 400 }
      );
    }

    // Verify race exists
    const { prisma } = await import('@/lib/prisma');
    const race = await prisma.raceRegistry.findUnique({
      where: { id: raceRegistryId },
    });

    if (!race) {
      return NextResponse.json({ success: false, error: 'Race not found' }, { status: 404 });
    }

    // Return success (plan generation happens separately via /api/training-plan/generate)
    return NextResponse.json({
      success: true,
      message: 'Training setup saved',
      raceRegistryId,
      goalTime,
    });
  } catch (error: any) {
    console.error('❌ TRAINING SETUP SAVE: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}


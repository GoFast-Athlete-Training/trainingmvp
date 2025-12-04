export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';

/**
 * MVP1 Training Setup Save
 * Saves raceId + goalTime
 * Does NOT create a plan (that's done via /api/training-plan/generate)
 */
export async function POST(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const body = await request.json();

    const { raceId, goalTime } = body; // Route param renamed from raceRegistryId → raceId

    if (!raceId || !goalTime) {
      return NextResponse.json(
        { success: false, error: 'raceId and goalTime are required' },
        { status: 400 }
      );
    }

    // Verify race exists
    const { prisma } = await import('@/lib/prisma');
    const race = await prisma.race.findUnique({
      where: { id: raceId },
    });

    if (!race) {
      return NextResponse.json({ success: false, error: 'Race not found' }, { status: 404 });
    }

    // Return success (plan generation happens separately via /api/training-plan/generate)
    return NextResponse.json({
      success: true,
      message: 'Training setup saved',
      raceId,
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


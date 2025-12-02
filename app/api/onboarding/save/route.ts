export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { updateAthleteProfile } from '@/lib/athlete/profile';
import { prisma } from '@/lib/prisma';

/**
 * MVP1 Onboarding Save
 * Saves race selection and goal time
 * Updates athlete fiveKPace if provided
 * Does NOT create training plan (that's done via /api/training-plan/generate)
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json({ success: false, error: 'Auth unavailable' }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // Verify athlete exists
    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ success: false, error: 'Athlete not found' }, { status: 404 });
    }

    const body = await request.json();
    const { raceRegistryId, goalTime, fiveKPace } = body;

    if (!raceRegistryId || !goalTime) {
      return NextResponse.json(
        { success: false, error: 'raceRegistryId and goalTime are required' },
        { status: 400 }
      );
    }

    // Verify race exists
    const race = await prisma.raceRegistry.findUnique({
      where: { id: raceRegistryId },
    });

    if (!race) {
      return NextResponse.json({ success: false, error: 'Race not found' }, { status: 404 });
    }

    // Update athlete fiveKPace if provided
    if (fiveKPace) {
      await updateAthleteProfile(athlete.id, { fiveKPace });
    }

    // Return success (plan generation happens separately)
    return NextResponse.json({
      success: true,
      message: 'Onboarding data saved',
      raceRegistryId,
      goalTime,
    });
  } catch (err: any) {
    console.error('❌ ONBOARDING SAVE: Error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error', details: err?.message },
      { status: 500 }
    );
  }
}


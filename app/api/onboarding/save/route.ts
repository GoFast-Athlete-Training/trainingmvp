export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId, updateAthlete } from '@/lib/domain-athlete';
import { prisma } from '@/lib/prisma';
import { getRaceDistanceMiles } from '@/lib/utils/pace';

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
    const {
      raceName,
      raceType,
      goalTime,
      goalPace,
      current5k,
      lastRaceFeeling,
      trainedBefore,
      inference,
    } = body;

    if (!raceName || !goalTime || !current5k) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Calculate race distance in miles
    const distanceMiles = getRaceDistanceMiles(raceType);

    // Create or find race
    let race = await prisma.race.findFirst({
      where: {
        raceName: {
          equals: raceName,
          mode: 'insensitive',
        },
        raceType: raceType.toLowerCase(),
      },
    });

    if (!race) {
      // Create new race (use a future date as placeholder, user can update later)
      const raceDate = new Date();
      raceDate.setMonth(raceDate.getMonth() + 3); // Default to 3 months from now

      race = await prisma.race.create({
        data: {
          raceName,
          raceType: raceType.toLowerCase(),
          raceDate,
          distanceMiles,
        },
      });
    }

    // Update athlete with onboarding data
    const updatedAthlete = await updateAthlete(athlete.id, {
      myTargetRace: raceName,
      myTrainingGoal: goalTime,
      myCurrentPace: current5k,
      // Store additional onboarding data in a JSON field if needed
      // For now, we'll store the key fields
    });

    // Store onboarding responses and inference (we can add a separate table later if needed)
    // For now, we'll store inference in a note or we can add it to the athlete model
    // Since the schema doesn't have an onboarding field, we'll store it in myTrainingGoal as JSON
    // Actually, let's keep it simple and just store the key fields

    // Return updated athlete data
    return NextResponse.json({
      success: true,
      message: 'Onboarding data saved',
      athlete: {
        id: updatedAthlete.id,
        firebaseId: updatedAthlete.firebaseId,
        email: updatedAthlete.email,
        myCurrentPace: updatedAthlete.myCurrentPace,
        myWeeklyMileage: updatedAthlete.myWeeklyMileage,
        myTrainingGoal: updatedAthlete.myTrainingGoal,
        myTargetRace: updatedAthlete.myTargetRace,
        myTrainingStartDate: updatedAthlete.myTrainingStartDate,
      },
      race: {
        id: race.id,
        raceName: race.raceName,
        raceType: race.raceType,
        raceDate: race.raceDate,
      },
    });
  } catch (err: any) {
    console.error('❌ ONBOARDING SAVE: Error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error', details: err?.message },
      { status: 500 }
    );
  }
}


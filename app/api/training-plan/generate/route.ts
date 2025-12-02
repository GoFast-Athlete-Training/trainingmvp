export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { generateTrainingPlanAI } from '@/lib/training/plan-generator';
import { saveTrainingPlanToDB } from '@/lib/training/save-plan';

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

    // Load athlete and race
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { fiveKPace: true },
    });

    if (!athlete) {
      return NextResponse.json({ success: false, error: 'Athlete not found' }, { status: 404 });
    }

    if (!athlete.fiveKPace) {
      return NextResponse.json(
        { success: false, error: 'Athlete must have fiveKPace set in profile' },
        { status: 400 }
      );
    }

    const race = await prisma.raceRegistry.findUnique({
      where: { id: raceRegistryId },
    });

    if (!race) {
      return NextResponse.json({ success: false, error: 'Race not found' }, { status: 404 });
    }

    // Calculate total weeks from race date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const raceDate = new Date(race.date);
    raceDate.setHours(0, 0, 0, 0);
    const daysUntilRace = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const totalWeeks = Math.max(8, Math.floor(daysUntilRace / 7)); // Minimum 8 weeks

    // Plan starts today
    const planStartDate = today;

    // Generate plan
    const plan = await generateTrainingPlanAI({
      raceName: race.name,
      raceDistance: race.distance,
      goalTime,
      fiveKPace: athlete.fiveKPace,
      totalWeeks,
    });

    // Save plan to database
    const trainingPlanId = await saveTrainingPlanToDB(
      athleteId,
      raceRegistryId,
      planStartDate,
      plan,
      race.name,
      goalTime,
      athlete.fiveKPace
    );

    return NextResponse.json({
      success: true,
      trainingPlanId,
      totalWeeks: plan.totalWeeks,
    });
  } catch (error: any) {
    console.error('❌ GENERATE PLAN: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}


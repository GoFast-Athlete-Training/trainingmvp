import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const TEST_ATHLETE_ID = process.env.NEXT_PUBLIC_TEST_ATHLETE_ID || 'test-athlete-id';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const athleteId = searchParams.get('athleteId') || TEST_ATHLETE_ID;

    const activePlan = await prisma.trainingPlan.findFirst({
      where: {
        athleteId,
        status: 'active',
      },
    });

    if (!activePlan) {
      return NextResponse.json(null);
    }

    // Get phase overview from plan structure
    // For now, we'll calculate phases based on total weeks
    const totalWeeks = activePlan.trainingPlanTotalWeeks;
    const baseWeeks = Math.floor(totalWeeks * 0.25);
    const buildWeeks = Math.floor(totalWeeks * 0.35);
    const peakWeeks = Math.floor(totalWeeks * 0.2);
    const taperWeeks = totalWeeks - baseWeeks - buildWeeks - peakWeeks;

    let currentWeek = 0;
    const phases = [
      {
        name: 'base',
        startWeek: 0,
        endWeek: baseWeeks - 1,
        weeks: Array.from({ length: baseWeeks }, (_, i) => i),
      },
      {
        name: 'build',
        startWeek: baseWeeks,
        endWeek: baseWeeks + buildWeeks - 1,
        weeks: Array.from({ length: buildWeeks }, (_, i) => i + baseWeeks),
      },
      {
        name: 'peak',
        startWeek: baseWeeks + buildWeeks,
        endWeek: baseWeeks + buildWeeks + peakWeeks - 1,
        weeks: Array.from({ length: peakWeeks }, (_, i) => i + baseWeeks + buildWeeks),
      },
      {
        name: 'taper',
        startWeek: baseWeeks + buildWeeks + peakWeeks,
        endWeek: totalWeeks - 1,
        weeks: Array.from({ length: taperWeeks }, (_, i) => i + baseWeeks + buildWeeks + peakWeeks),
      },
    ];

    // Get weekly mileage (simplified - would need to calculate from planned days)
    const weeklyMileage = Array.from({ length: totalWeeks }, () => 0);

    return NextResponse.json({
      id: activePlan.id,
      name: activePlan.trainingPlanName,
      totalWeeks,
      phases,
      weeklyMileage,
    });
  } catch (error) {
    console.error('Error loading plan:', error);
    return NextResponse.json({ error: 'Failed to load plan' }, { status: 500 });
  }
}


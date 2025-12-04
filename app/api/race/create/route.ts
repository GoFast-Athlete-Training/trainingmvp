export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 RACE CREATE: Starting race creation...');
    
    let athleteId: string;
    try {
      athleteId = await getAthleteIdFromRequest(request);
      console.log('✅ RACE CREATE: Athlete ID obtained:', athleteId);
    } catch (err: any) {
      console.error('❌ RACE CREATE: Failed to get athlete ID:', err?.message);
      return NextResponse.json(
        { success: false, error: 'Authentication failed', details: err?.message },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('📝 RACE CREATE: Request body:', body);

    const { name, distance, date, city, state, country } = body;

    if (!name || !distance || !date) {
      return NextResponse.json(
        { success: false, error: 'Name, distance, and date are required' },
        { status: 400 }
      );
    }

    console.log('💾 RACE CREATE: Creating race in database...');
    const race = await prisma.raceRegistry.create({
      data: {
        name,
        distance,
        date: new Date(date),
        city: city || null,
        state: state || null,
        country: country || null,
        createdBy: athleteId,
        isGlobal: false,
      },
    });

    console.log('✅ RACE CREATE: Race created successfully:', race.id);

    return NextResponse.json({
      success: true,
      race: {
        id: race.id,
        name: race.name,
        distance: race.distance,
        date: race.date,
        city: race.city,
        state: race.state,
        country: race.country,
      },
    });
  } catch (error: any) {
    console.error('❌ RACE CREATE: Error:', error);
    console.error('❌ RACE CREATE: Error code:', error?.code);
    console.error('❌ RACE CREATE: Error meta:', error?.meta);
    console.error('❌ RACE CREATE: Error stack:', error?.stack);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create race', 
        details: error?.message || 'Unknown error',
        code: error?.code,
      },
      { status: error.message?.includes('Unauthorized') || error.message?.includes('Athlete not found') ? 401 : 500 }
    );
  }
}


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

    // Store body for use in catch block
    const requestBody = { name, distance, date, city, state, country };

    console.log('🔍 RACE CREATE: Checking if race already exists...');
    const raceDate = new Date(date);
    
    // Check if race already exists (registry should be unique!)
    const existingRace = await prisma.raceRegistry.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
        date: raceDate,
      },
    });

    if (existingRace) {
      console.log('✅ RACE CREATE: Race already exists in registry:', existingRace.id);
      return NextResponse.json({
        success: true,
        race: {
          id: existingRace.id,
          name: existingRace.name,
          distance: existingRace.distance,
          date: existingRace.date,
          city: existingRace.city,
          state: existingRace.state,
          country: existingRace.country,
        },
        message: 'Race already exists in registry',
      });
    }

    console.log('💾 RACE CREATE: Creating new race in database...');
    const race = await prisma.raceRegistry.create({
      data: {
        name,
        distance,
        date: raceDate,
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
    
    // Handle unique constraint violation (duplicate race)
    if (error.code === 'P2002' || error.code === '23505') {
      console.log('⚠️ RACE CREATE: Duplicate race detected, attempting to find existing...');
      try {
        // Use the variables from the request body (available in outer scope)
        if (!name || !date) {
          throw new Error('Missing race name or date in error handler');
        }
        
        const existingRace = await prisma.raceRegistry.findFirst({
          where: {
            name: {
              equals: name,
              mode: 'insensitive',
            },
            date: new Date(date),
          },
        });
        
        if (existingRace) {
          console.log('✅ RACE CREATE: Found existing race:', existingRace.id);
          return NextResponse.json({
            success: true,
            race: {
              id: existingRace.id,
              name: existingRace.name,
              distance: existingRace.distance,
              date: existingRace.date,
              city: existingRace.city,
              state: existingRace.state,
              country: existingRace.country,
            },
            message: 'Race already exists in registry',
          });
        }
      } catch (findError) {
        console.error('❌ RACE CREATE: Error finding existing race:', findError);
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Race already exists', 
          details: 'A race with this name and date already exists in the registry',
          code: error?.code,
        },
        { status: 409 }
      );
    }
    
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


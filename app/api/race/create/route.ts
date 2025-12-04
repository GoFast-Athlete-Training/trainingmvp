export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { getRaceMiles, isValidRaceType } from '@/config/race-types';

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

    const { name, distance, raceType, date, city, state, country } = body;

    // Support both old 'distance' field and new 'raceType' field for backward compatibility
    const finalRaceType = raceType || distance;
    
    if (!name || !finalRaceType || !date) {
      return NextResponse.json(
        { success: false, error: 'Name, raceType, and date are required' },
        { status: 400 }
      );
    }

    // Validate race type and get miles
    if (!isValidRaceType(finalRaceType)) {
      return NextResponse.json(
        { success: false, error: `Invalid race type: ${finalRaceType}. Supported: marathon, half, 10k, 5k, 10m` },
        { status: 400 }
      );
    }

    const miles = getRaceMiles(finalRaceType);
    console.log('📊 RACE CREATE: Race type:', finalRaceType, 'Miles:', miles);

    console.log('🔍 RACE CREATE: Searching registry first (search-before-create pattern)...');
    // Normalize date to UTC midnight to prevent timezone issues
    // Parse date string and create UTC date (race dates are date-only)
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const [year, month, day] = dateStr.split('-').map(Number);
    const raceDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    
    console.log('📅 RACE CREATE: Normalized date:', raceDate.toISOString());
    
    // REGISTRY PATTERN: Search first, if exists, return it. If not, create it.
    const existingRace = await prisma.race.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
        date: raceDate,
      },
    });

    if (existingRace) {
      console.log('✅ RACE CREATE: Race found in registry (reusing existing):', existingRace.id);
      return NextResponse.json({
        success: true,
        race: {
          id: existingRace.id,
          name: existingRace.name,
          raceType: existingRace.raceType,
          miles: existingRace.miles,
          date: existingRace.date,
          city: existingRace.city,
          state: existingRace.state,
          country: existingRace.country,
        },
        message: 'Race found in registry',
      });
    }

    console.log('💾 RACE CREATE: Race not found in registry, creating new entry...');
    const race = await prisma.race.create({
      data: {
        name,
        raceType: finalRaceType,
        miles: miles,
        date: raceDate,
        city: city || null,
        state: state || null,
        country: country || null,
        createdBy: athleteId, // Optional tracking, not ownership
      },
    });

    console.log('✅ RACE CREATE: Race created successfully:', race.id);

    return NextResponse.json({
      success: true,
      race: {
        id: race.id,
        name: race.name,
        raceType: race.raceType,
        miles: race.miles,
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
        // Try to get body from request (may fail if already consumed)
        let bodyData: any;
        try {
          bodyData = await request.json();
        } catch {
          // If body already consumed, we can't recover - return error
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
        
        const { name: errorName, date: errorDate } = bodyData;
        if (!errorName || !errorDate) {
          throw new Error('Missing race name or date in error handler');
        }
        
        const existingRace = await prisma.race.findFirst({
          where: {
            name: {
              equals: errorName,
              mode: 'insensitive',
            },
            date: new Date(errorDate),
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


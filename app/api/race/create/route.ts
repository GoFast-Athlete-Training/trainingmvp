export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { getRaceMiles, isValidRaceType } from '@/config/race-types';

export async function POST(request: NextRequest) {
  // Declare variables outside try block so they're accessible in catch
  let name: string | undefined;
  let raceDate: Date | undefined;
  
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

    const { name: bodyName, distance, raceType, date, city, state, country } = body;
    name = bodyName; // Assign to outer scope variable

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

    // Normalize date to UTC midnight to prevent timezone issues
    // Parse date string and create UTC date (race dates are date-only)
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const [year, month, day] = dateStr.split('-').map(Number);
    raceDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)); // Assign to outer scope variable
    
    console.log('📅 RACE CREATE: Normalized date:', raceDate.toISOString());
    console.log('🔍 RACE CREATE: Searching for race:', { name, date: raceDate.toISOString() });
    
    // REGISTRY PATTERN: Find or create race (upsert)
    // Always returns race ID - frontend doesn't need to know if it was created or found
    // Use findFirst + create pattern since Prisma doesn't support compound unique constraints in upsert
    let race = await prisma.race_registry.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
        date: raceDate,
      },
    });
    
    if (!race) {
      console.log('⚠️ RACE CREATE: No exact match found, checking all races with same name...');
      // Try finding by name only to see if there's a date mismatch
      const racesByName = await prisma.race_registry.findMany({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      });
      console.log(`📊 RACE CREATE: Found ${racesByName.length} races with name "${name}":`, 
        racesByName.map(r => ({ id: r.id, name: r.name, date: r.date?.toISOString() }))
      );
    }

    if (!race) {
      // Race doesn't exist - create it
      race = await prisma.race_registry.create({
        data: {
          name,
          raceType: finalRaceType,
          miles: miles,
          date: raceDate,
          city: city || null,
          state: state || null,
          country: country || null,
          // createdBy field removed - not in schema
        },
      });
      console.log('✅ RACE CREATE: Race created:', race.id);
    } else {
      console.log('✅ RACE CREATE: Race found in registry:', race.id);
    }

    console.log('✅ RACE CREATE: Race found or created:', race.id);

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


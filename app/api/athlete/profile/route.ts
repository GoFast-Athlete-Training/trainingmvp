export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { getAthleteProfile, updateAthleteProfile } from '@/lib/athlete/profile';

export async function GET(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const profile = await getAthleteProfile(athleteId);

    if (!profile) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error: any) {
    console.error('❌ GET PROFILE: Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const body = await request.json();

    const updated = await updateAthleteProfile(athleteId, {
      firstName: body.firstName,
      lastName: body.lastName,
      gofastHandle: body.gofastHandle,
      city: body.city,
      state: body.state,
      gender: body.gender,
      birthday: body.birthday ? new Date(body.birthday) : undefined,
      primarySport: body.primarySport,
      instagram: body.instagram,
      fiveKPace: body.fiveKPace,
    });

    return NextResponse.json({
      success: true,
      profile: {
        firstName: updated.firstName,
        lastName: updated.lastName,
        gofastHandle: updated.gofastHandle,
        city: updated.city,
        state: updated.state,
        gender: updated.gender,
        birthday: updated.birthday,
        primarySport: updated.primarySport,
        instagram: updated.instagram,
        fiveKPace: updated.fiveKPace,
      },
    });
  } catch (error: any) {
    console.error('❌ UPDATE PROFILE: Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Invalid') ? 400 : 500 }
    );
  }
}


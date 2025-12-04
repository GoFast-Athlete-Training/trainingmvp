export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId, hydrateAthlete } from '@/lib/domain-athlete';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      console.error('❌ HYDRATE: Firebase Admin not initialized - check FIREBASE_SERVICE_ACCOUNT env var');
      return NextResponse.json({ 
        success: false,
        error: 'Authentication service unavailable. Please check server configuration.' 
      }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch (err: any) {
      console.error('❌ HYDRATE: Token verification failed:', err?.message);
      return NextResponse.json({ 
        success: false,
        error: 'Invalid or expired token' 
      }, { status: 401 });
    }

    const firebaseId = decodedToken.uid;

    let athlete;
    try {
      athlete = await getAthleteByFirebaseId(firebaseId);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!athlete) {
      return NextResponse.json({ 
        success: false,
        error: 'Athlete not found' 
      }, { status: 404 });
    }

    let hydrated;
    try {
      hydrated = await hydrateAthlete(athlete.id);
    } catch (err: any) {
      console.error('❌ HYDRATE: Prisma error:', err);
      return NextResponse.json({ error: 'DB error', details: err?.message }, { status: 500 });
    }

    if (!hydrated) {
      return NextResponse.json({ 
        success: false,
        error: 'Failed to hydrate athlete data' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      athlete: hydrated.athlete 
    });
  } catch (err: any) {
    console.error('❌ HYDRATE: Unexpected error:', err);
    return NextResponse.json({ 
      success: false,
      error: 'Server error', 
      details: err?.message 
    }, { status: 500 });
  }
}


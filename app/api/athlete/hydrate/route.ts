export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId, hydrateAthlete } from '@/lib/domain-athlete';

export async function POST(request: Request) {
  try {
    console.log('🚀 HYDRATE API: ===== STARTING REQUEST =====');
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('❌ HYDRATE API: No Bearer token found');
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized - No token provided' 
      }, { status: 401 });
    }

    console.log('✅ HYDRATE API: Bearer token found, initializing Firebase Admin...');
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      console.error('❌ HYDRATE API: Firebase Admin not initialized - check FIREBASE_SERVICE_ACCOUNT env var');
      return NextResponse.json({ 
        success: false,
        error: 'Authentication service unavailable. Please check server configuration.',
        details: 'Firebase Admin SDK not initialized'
      }, { status: 500 });
    }

    console.log('✅ HYDRATE API: Firebase Admin initialized, verifying token...');
    let decodedToken;
    try {
      const token = authHeader.substring(7);
      decodedToken = await adminAuth.verifyIdToken(token);
      console.log('✅ HYDRATE API: Token verified, Firebase UID:', decodedToken.uid);
    } catch (err: any) {
      console.error('❌ HYDRATE API: Token verification failed:', err?.message);
      console.error('❌ HYDRATE API: Token error details:', err);
      return NextResponse.json({ 
        success: false,
        error: 'Invalid or expired token',
        details: err?.message
      }, { status: 401 });
    }

    const firebaseId = decodedToken.uid;
    console.log('🔍 HYDRATE API: Looking up athlete by Firebase ID:', firebaseId);

    let athlete;
    try {
      athlete = await getAthleteByFirebaseId(firebaseId);
      console.log('✅ HYDRATE API: Athlete lookup result:', athlete ? `Found athlete ID: ${athlete.id}` : 'Not found');
    } catch (err: any) {
      console.error('❌ HYDRATE API: Prisma error during athlete lookup:', err);
      console.error('❌ HYDRATE API: Error stack:', err?.stack);
      return NextResponse.json({ 
        success: false,
        error: 'Database error during athlete lookup',
        details: err?.message,
        stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
      }, { status: 500 });
    }

    if (!athlete) {
      console.log('❌ HYDRATE API: Athlete not found for Firebase ID:', firebaseId);
      return NextResponse.json({ 
        success: false,
        error: 'Athlete not found',
        details: `No athlete record found for Firebase ID: ${firebaseId}`
      }, { status: 404 });
    }

    console.log('🚀 HYDRATE API: Starting hydration for athlete ID:', athlete.id);
    let hydrated;
    try {
      hydrated = await hydrateAthlete(athlete.id);
      console.log('✅ HYDRATE API: Hydration completed successfully');
      console.log('✅ HYDRATE API: Hydrated athlete has', hydrated?.athlete?.trainingPlans?.length || 0, 'training plans');
    } catch (err: any) {
      console.error('❌ HYDRATE API: Prisma error during hydration:', err);
      console.error('❌ HYDRATE API: Error message:', err?.message);
      console.error('❌ HYDRATE API: Error stack:', err?.stack);
      console.error('❌ HYDRATE API: Full error:', JSON.stringify(err, null, 2));
      return NextResponse.json({ 
        success: false,
        error: 'Database error during hydration',
        details: err?.message,
        stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
      }, { status: 500 });
    }

    if (!hydrated) {
      console.error('❌ HYDRATE API: Hydration returned null');
      return NextResponse.json({ 
        success: false,
        error: 'Failed to hydrate athlete data',
        details: 'Hydration function returned null'
      }, { status: 500 });
    }

    console.log('✅ HYDRATE API: Returning hydrated athlete data');
    console.log('✅ HYDRATE API: ===== REQUEST SUCCESS =====');
    return NextResponse.json({ 
      success: true, 
      athlete: hydrated.athlete 
    });
  } catch (err: any) {
    console.error('❌ HYDRATE API: ===== UNEXPECTED ERROR =====');
    console.error('❌ HYDRATE API: Error message:', err?.message);
    console.error('❌ HYDRATE API: Error stack:', err?.stack);
    console.error('❌ HYDRATE API: Full error:', JSON.stringify(err, null, 2));
    return NextResponse.json({ 
      success: false,
      error: 'Server error', 
      details: err?.message,
      stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    }, { status: 500 });
  }
}


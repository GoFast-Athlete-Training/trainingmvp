export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { prisma } from '@/lib/prisma';

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
    let adminAuth;
    try {
      adminAuth = getAdminAuth();
    } catch (err: any) {
      console.error('❌ HYDRATE API: Failed to get Firebase Admin Auth');
      console.error('❌ HYDRATE API: Error:', err?.message);
      return NextResponse.json({ 
        success: false,
        error: 'Firebase Admin initialization failed',
        details: err?.message || 'Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars'
      }, { status: 500 });
    }

    if (!adminAuth) {
      console.error('❌ HYDRATE API: Firebase Admin not initialized');
      console.error('❌ HYDRATE API: Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars');
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      console.error('❌ HYDRATE API: Env vars present:', {
        projectId: !!projectId,
        clientEmail: !!clientEmail,
        privateKey: !!privateKey,
      });
      return NextResponse.json({ 
        success: false,
        error: 'Authentication service unavailable. Please check server configuration.',
        details: 'Firebase Admin SDK not initialized. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY environment variables.'
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
      console.error('❌ HYDRATE API: Error code:', err?.code);
      console.error('❌ HYDRATE API: Error name:', err?.name);
      
      // Check if it's a Firebase Admin initialization error
      if (err?.message?.includes('Firebase Admin env vars missing') || err?.message?.includes('Firebase Admin')) {
        console.error('❌ HYDRATE API: Firebase Admin initialization failed');
        return NextResponse.json({ 
          success: false,
          error: 'Firebase Admin initialization failed',
          details: err?.message || 'Check Firebase environment variables'
        }, { status: 500 });
      }
      
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

    console.log('✅ HYDRATE API: Athlete found, loading latest training plan...');
    
    // MVP1: Load latest plan (do NOT require AthleteTrainingPlan junction table)
    let trainingPlanId = null;
    try {
      // TODO: status removed - will be handled via execution-based lifecycle
      // For now, just get the latest plan
      let plan = await prisma.training_plans.findFirst({
        where: { 
          athleteId: athlete.id,
        },
        select: {
          id: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (plan) {
        trainingPlanId = plan.id;
        console.log('✅ HYDRATE API: Found training plan ID:', trainingPlanId);
      } else {
        console.log('✅ HYDRATE API: No training plan found');
      }
    } catch (err: any) {
      console.error('❌ HYDRATE API: Error loading training plan:', err?.message);
      // Don't fail if we can't load plan - just leave it null
    }

    console.log('✅ HYDRATE API: ===== REQUEST SUCCESS =====');

    // Return full athlete object with trainingPlanId bolted on
    return NextResponse.json({ 
      success: true, 
      athlete: {
        id: athlete.id,
        firebaseId: athlete.firebaseId,
        email: athlete.email,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        fiveKPace: athlete.fiveKPace,
        companyId: athlete.companyId,
        gofastHandle: athlete.gofastHandle,
        photoURL: athlete.photoURL,
        city: athlete.city,
        state: athlete.state,
        primarySport: athlete.primarySport,
        // Training plan ID bolted to athleteId
        trainingPlanId: trainingPlanId,
      }
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


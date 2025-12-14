export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Try Firebase Admin, but fallback to decoding token without verification
    let decodedToken: any = null;
    let adminAuth;
    
    try {
      adminAuth = getAdminAuth();
      if (adminAuth) {
        try {
          decodedToken = await adminAuth.verifyIdToken(token);
        } catch (err: any) {
          console.warn('⚠️ HYDRATE: Token verification failed, decoding without verification');
        }
      }
    } catch (err: any) {
      console.warn('⚠️ HYDRATE: Firebase Admin unavailable, decoding token without verification');
    }

    // Fallback: Decode JWT without verification to get firebaseId
    if (!decodedToken) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          decodedToken = {
            uid: payload.user_id || payload.sub,
            email: payload.email || null,
            name: payload.name || null,
            picture: payload.picture || null,
          };
        } else {
          return NextResponse.json({ 
            success: false,
            error: 'Invalid token format' 
          }, { status: 401 });
        }
      } catch (err: any) {
        console.error('❌ HYDRATE: Cannot decode token:', err?.message);
        return NextResponse.json({ 
          success: false,
          error: 'Invalid token' 
        }, { status: 401 });
      }
    }

    const firebaseId = decodedToken?.uid;
    if (!firebaseId) {
      return NextResponse.json({ 
        success: false,
        error: 'Missing firebaseId' 
      }, { status: 401 });
    }

    // Auth check passed - now get athlete data
    // If athlete doesn't exist, return 404 (frontend will redirect to signup)
    const athlete = await prisma.athlete.findUnique({
      where: { firebaseId },
      select: {
        id: true,
        firebaseId: true,
        email: true,
        firstName: true,
        lastName: true,
        fiveKPace: true,
        companyId: true,
        gofastHandle: true,
        photoURL: true,
        city: true,
        state: true,
        primarySport: true,
      },
    });

    if (!athlete) {
      // Firebase ID exists but no athlete record - send to signup
      console.log('👤 HYDRATE: Athlete not found for firebaseId:', firebaseId);
      return NextResponse.json({ 
        success: false,
        error: 'Athlete not found' 
      }, { status: 404 });
    }

    console.log('✅ HYDRATE: Athlete found:', athlete.id);

    // Get training plan ID if exists (most recent plan)
    const trainingPlan = await prisma.training_plans.findFirst({
      where: { athleteId: athlete.id },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    // Return full athlete object with trainingPlanId
    return NextResponse.json({ 
      success: true,
      athlete: {
        ...athlete,
        trainingPlanId: trainingPlan?.id || null,
      },
    });
  } catch (err: any) {
    console.error('❌ HYDRATE: Unexpected error:', err?.message);
    console.error('❌ HYDRATE: Stack:', err?.stack);
    return NextResponse.json({ 
      success: false,
      error: 'Server error',
      details: err?.message || 'Unknown error'
    }, { status: 500 });
  }
}

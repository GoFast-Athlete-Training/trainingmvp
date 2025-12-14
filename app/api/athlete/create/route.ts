export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('❌ ATHLETE CREATE: Missing or invalid auth header');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    console.log('🔑 ATHLETE CREATE: Received token (first 20 chars):', token.substring(0, 20) + '...');
    
    let adminAuth;
    try {
      adminAuth = getAdminAuth();
    } catch (err: any) {
      console.error('❌ ATHLETE CREATE: Failed to get Firebase Admin Auth');
      console.error('❌ ATHLETE CREATE: Error:', err?.message);
      return NextResponse.json({ 
        success: false, 
        error: 'Firebase Admin initialization failed',
        details: err?.message || 'Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars'
      }, { status: 500 });
    }

    if (!adminAuth) {
      console.error('❌ ATHLETE CREATE: Firebase Admin Auth is null');
      console.error('❌ ATHLETE CREATE: Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars');
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      console.error('❌ ATHLETE CREATE: Env vars present:', {
        projectId: !!projectId,
        clientEmail: !!clientEmail,
        privateKey: !!privateKey,
      });
      return NextResponse.json({ 
        success: false, 
        error: 'Auth unavailable',
        details: 'Firebase Admin SDK not initialized. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY environment variables.'
      }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
      console.log('✅ ATHLETE CREATE: Token verified for UID:', decodedToken.uid);
    } catch (err: any) {
      console.error('❌ ATHLETE CREATE: Token verification failed');
      console.error('❌ ATHLETE CREATE: Error code:', err?.code);
      console.error('❌ ATHLETE CREATE: Error message:', err?.message);
      console.error('❌ ATHLETE CREATE: Error name:', err?.name);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid token',
        details: err?.message || 'Token verification failed'
      }, { status: 401 });
    }

    const firebaseId = decodedToken.uid;
    const email = decodedToken.email || undefined;
    const displayName = decodedToken.name || undefined;
    const picture = decodedToken.picture || undefined;

    // Parse displayName into firstName/lastName if available
    const nameParts = displayName?.split(' ') || [];
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.slice(1).join(' ').trim() || undefined;

    // Step 1: Resolve Canonical Company (DB Source of Truth)
    const company = await prisma.goFastCompany.findFirst();
    if (!company) {
      console.error("❌ ATHLETE CREATE: No GoFastCompany found");
      throw new Error("No GoFastCompany found. Athlete creation requires a company.");
    }
    console.log('✅ ATHLETE CREATE: Using company:', company.id, company.name || company.slug);

    // Upsert athlete with automatic company assignment
    console.log('👤 ATHLETE CREATE: Upserting athlete with firebaseId:', firebaseId);
    let athlete;
    try {
      // companyId is always derived from GoFastCompany (ultra container)
      athlete = await prisma.athlete.upsert({
      where: { firebaseId },
      update: {
        // Sync Firebase data on update
        email: email || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        photoURL: picture || undefined,
        companyId: company.id,
      },
      create: {
        firebaseId,
        email: email || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        photoURL: picture || undefined,
        companyId: company.id,
      },
    });
      console.log('✅ ATHLETE CREATE: Athlete found/created:', athlete.id);
    } catch (err: any) {
      console.error('❌ ATHLETE CREATE: Athlete upsert failed:', err);
      console.error('❌ ATHLETE CREATE: Error code:', err?.code);
      console.error('❌ ATHLETE CREATE: Error meta:', err?.meta);
      
      // Check for Prisma unique constraint violations (email already exists)
      if (err?.code === 'P2002') {
        console.error('❌ ATHLETE CREATE: Unique constraint violation');
        return NextResponse.json({ 
          success: false, 
          error: 'Email already exists',
          details: err?.meta?.target ? `Field ${err.meta.target.join(', ')} already exists` : err?.message
        }, { status: 409 });
      }
      
      throw err; // Re-throw to be caught by outer catch
    }

    // Format response like gofastapp-mvp
    return NextResponse.json({
      success: true,
      message: 'Athlete found or created',
      athleteId: athlete.id,
      data: {
        id: athlete.id,
        firebaseId: athlete.firebaseId,
        email: athlete.email,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        gofastHandle: athlete.gofastHandle,
        birthday: athlete.birthday,
        gender: athlete.gender,
        city: athlete.city,
        state: athlete.state,
        primarySport: athlete.primarySport,
        photoURL: athlete.photoURL,
        bio: athlete.bio,
        instagram: athlete.instagram,
        fiveKPace: athlete.fiveKPace,
        createdAt: athlete.createdAt,
        updatedAt: athlete.updatedAt,
      },
    });
  } catch (err: any) {
    console.error('❌ ATHLETE CREATE: Error:', err);
    console.error('❌ ATHLETE CREATE: Error code:', err?.code);
    console.error('❌ ATHLETE CREATE: Error name:', err?.name);
    console.error('❌ ATHLETE CREATE: Error stack:', err?.stack);
    
    // Check for Prisma unique constraint violations (if not already handled)
    if (err?.code === 'P2002') {
      return NextResponse.json({ 
        success: false, 
        error: 'Email already exists',
        details: err?.meta?.target ? `Field ${err.meta.target.join(', ')} already exists` : err?.message
      }, { status: 409 });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Server error', 
      details: err?.message || 'Unknown error',
      code: err?.code,
    }, { status: 500 });
  }
}


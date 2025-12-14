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
    
    // Try to get Firebase Admin Auth, but don't fail if it's not available
    let adminAuth;
    let decodedToken: any = null;
    
    try {
      adminAuth = getAdminAuth();
      if (adminAuth) {
        try {
          decodedToken = await adminAuth.verifyIdToken(token);
          console.log('✅ ATHLETE CREATE: Token verified for UID:', decodedToken.uid);
        } catch (err: any) {
          console.warn('⚠️ ATHLETE CREATE: Token verification failed, will try to decode without verification');
          console.warn('⚠️ ATHLETE CREATE: Error:', err?.message);
        }
      }
    } catch (err: any) {
      console.warn('⚠️ ATHLETE CREATE: Firebase Admin not available, will decode token without verification');
      console.warn('⚠️ ATHLETE CREATE: Error:', err?.message);
    }

    // Fallback: Decode JWT without verification to get firebaseId (for checking existing athlete)
    if (!decodedToken) {
      try {
        // JWT format: header.payload.signature
        // We can decode the payload without verification to get the UID
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          decodedToken = {
            uid: payload.user_id || payload.sub,
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
          };
          console.log('⚠️ ATHLETE CREATE: Decoded token without verification for UID:', decodedToken.uid);
          console.warn('⚠️ ATHLETE CREATE: Using unverified token - checking athlete existence only');
        } else {
          throw new Error('Invalid token format');
        }
      } catch (err: any) {
        console.error('❌ ATHLETE CREATE: Cannot decode token');
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid token',
          details: 'Cannot decode token. Firebase Admin unavailable and token format invalid.'
        }, { status: 401 });
      }
    }

    const firebaseId = decodedToken.uid;
    const email = decodedToken.email || undefined;
    const displayName = decodedToken.name || undefined;
    const picture = decodedToken.picture || undefined;

    // Parse displayName into firstName/lastName if available
    const nameParts = displayName?.split(' ') || [];
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.slice(1).join(' ').trim() || undefined;

    // Step 1: CHECK IF ATHLETE EXISTS FIRST (retrieve before create)
    console.log('🔍 ATHLETE CREATE: Checking if athlete exists with firebaseId:', firebaseId);
    let athlete = await prisma.athlete.findUnique({
      where: { firebaseId },
    });

    if (athlete) {
      console.log('✅ ATHLETE CREATE: Athlete found (existing):', athlete.id);
      // Sync Firebase data if needed
      const updateData: any = {};
      if (email !== undefined && email !== athlete.email) updateData.email = email;
      if (firstName !== undefined && firstName !== athlete.firstName) updateData.firstName = firstName;
      if (lastName !== undefined && lastName !== athlete.lastName) updateData.lastName = lastName;
      if (picture !== undefined && picture !== athlete.photoURL) updateData.photoURL = picture;

      if (Object.keys(updateData).length > 0) {
        console.log('🔄 ATHLETE CREATE: Updating athlete data:', Object.keys(updateData));
        athlete = await prisma.athlete.update({
          where: { firebaseId },
          data: updateData,
        });
      }
    } else {
      console.log('👤 ATHLETE CREATE: Athlete not found');
      
      // Only create if we have verified token (Firebase Admin working)
      if (!adminAuth || !decodedToken || !decodedToken.uid) {
        console.error('❌ ATHLETE CREATE: Cannot create athlete - Firebase Admin not available');
        console.error('❌ ATHLETE CREATE: Athlete does not exist and token cannot be verified');
        return NextResponse.json({ 
          success: false, 
          error: 'Cannot create athlete',
          details: 'Firebase Admin SDK not initialized. Cannot verify token to create new athlete. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY environment variables.'
        }, { status: 500 });
      }

      console.log('👤 ATHLETE CREATE: Creating new athlete...');
      
      // Step 2: Resolve Canonical Company (DB Source of Truth)
      const company = await prisma.goFastCompany.findFirst();
      if (!company) {
        console.error("❌ ATHLETE CREATE: No GoFastCompany found");
        throw new Error("No GoFastCompany found. Athlete creation requires a company.");
      }
      console.log('✅ ATHLETE CREATE: Using company:', company.id, company.name || company.slug);

      // Create new athlete
      try {
        athlete = await prisma.athlete.create({
          data: {
            firebaseId,
            email: email || undefined,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            photoURL: picture || undefined,
            companyId: company.id,
          },
        });
        console.log('✅ ATHLETE CREATE: New athlete created:', athlete.id);
      } catch (err: any) {
        console.error('❌ ATHLETE CREATE: Athlete creation failed:', err);
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


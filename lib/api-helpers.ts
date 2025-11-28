import { NextRequest } from 'next/server';
import { verifyFirebaseIdToken } from './firebaseAdmin';
import { getAthleteByFirebaseId } from './domain-athlete';

/**
 * Get athleteId from request by verifying Firebase token
 * Throws error if token is invalid or athlete not found
 */
export async function getAthleteIdFromRequest(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No auth token provided');
  }

  const token = authHeader.substring(7);
  const decoded = await verifyFirebaseIdToken(token);
  
  if (!decoded) {
    throw new Error('Invalid token');
  }

  const athlete = await getAthleteByFirebaseId(decoded.uid);
  
  if (!athlete) {
    throw new Error('Athlete not found');
  }

  return athlete.id;
}


export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAthleteByGarminUserId } from '@/lib/domain-garmin';

/**
 * POST /api/garmin/webhook
 * 
 * Endpoint for Garmin's activity file uploads and notifications.
 * Responds with 200 OK immediately, then processes data asynchronously.
 */
export async function POST(request: Request) {
  // 1. Acknowledge Garmin immediately (required for webhook compliance)
  const acknowledgeResponse = NextResponse.json({ success: true }, { status: 200 });

  // 2. Process webhook data asynchronously (don't await)
  processWebhookData(request).catch((error) => {
    console.error('❌ Error processing Garmin webhook:', error);
  });

  return acknowledgeResponse;
}

/**
 * Process webhook data asynchronously
 */
async function processWebhookData(request: Request) {
  try {
    const body = await request.json();
    console.log('📩 Garmin webhook received:', {
      keys: Object.keys(body),
      timestamp: new Date().toISOString()
    });

    // Handle different webhook event types
    if (body.activities && Array.isArray(body.activities)) {
      // Activity summary webhook
      await handleActivityWebhook(body.activities, body.userId);
    } else if (body.activityDetails && Array.isArray(body.activityDetails)) {
      // Activity details webhook
      await handleActivityDetailsWebhook(body.activityDetails, body.userId);
    } else if (body.eventType) {
      // Generic webhook event
      await handleGenericWebhook(body);
    } else {
      console.warn('⚠️ Unknown webhook payload structure:', Object.keys(body));
    }

  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    // Don't throw - we've already acknowledged the webhook
  }
}

/**
 * Handle activity summary webhook
 */
async function handleActivityWebhook(activities: any[], userId?: string) {
  console.log(`📊 Processing ${activities.length} activity summary(ies)`);

  for (const activity of activities) {
    try {
      const garminUserId = userId || activity.userId;
      if (!garminUserId) {
        console.warn('⚠️ No userId found in activity webhook');
        continue;
      }

      // Find athlete by Garmin user ID
      const athlete = await getAthleteByGarminUserId(garminUserId);
      if (!athlete) {
        console.warn(`⚠️ Athlete not found for Garmin userId: ${garminUserId}`);
        continue;
      }

      // Check if activity already exists
      const existingActivity = await prisma.athlete_activities.findUnique({
        where: { sourceActivityId: activity.activityId?.toString() || activity.id?.toString() }
      });

      if (existingActivity) {
        console.log(`⏭️ Activity ${activity.activityId} already exists, skipping`);
        continue;
      }

      // Create activity record
      await prisma.athlete_activities.create({
        data: {
          athleteId: athlete.id,
          sourceActivityId: activity.activityId?.toString() || activity.id?.toString(),
          source: 'garmin',
          activityType: activity.activityType,
          activityName: activity.activityName,
          startTime: activity.startTime ? new Date(activity.startTime) : null,
          duration: activity.duration,
          distance: activity.distance,
          calories: activity.calories,
          averageSpeed: activity.averageSpeed,
          averageHeartRate: activity.averageHeartRate,
          maxHeartRate: activity.maxHeartRate,
          elevationGain: activity.elevationGain,
          steps: activity.steps,
          summaryData: activity
        }
      });

      console.log(`✅ Activity ${activity.activityId} saved for athlete ${athlete.id}`);

    } catch (error: any) {
      console.error(`❌ Error processing activity ${activity.activityId}:`, error);
    }
  }
}

/**
 * Handle activity details webhook
 */
async function handleActivityDetailsWebhook(activityDetails: any[], userId?: string) {
  console.log(`📊 Processing ${activityDetails.length} activity detail(s)`);

  for (const detail of activityDetails) {
    try {
      const garminUserId = userId || detail.userId;
      if (!garminUserId) {
        console.warn('⚠️ No userId found in activity detail webhook');
        continue;
      }

      const athlete = await getAthleteByGarminUserId(garminUserId);
      if (!athlete) {
        console.warn(`⚠️ Athlete not found for Garmin userId: ${garminUserId}`);
        continue;
      }

      const activityId = detail.activityId?.toString() || detail.id?.toString();
      
      // Update existing activity with detail data
      await prisma.athlete_activities.updateMany({
        where: {
          athleteId: athlete.id,
          sourceActivityId: activityId
        },
        data: {
          detailData: detail,
          hydratedAt: new Date()
        }
      });

      console.log(`✅ Activity detail ${activityId} updated for athlete ${athlete.id}`);

    } catch (error: any) {
      console.error(`❌ Error processing activity detail:`, error);
    }
  }
}

/**
 * Handle generic webhook events (permissions, deregistration, etc.)
 */
async function handleGenericWebhook(body: any) {
  const { eventType, userId, data } = body;
  console.log(`📡 Generic webhook event: ${eventType}`, { userId });

  switch (eventType) {
    case 'permissions_changed':
      console.log('🔐 Permissions changed:', data);
      // TODO: Update permissions in database
      break;
    case 'user_deregistered':
      console.log('👋 User deregistered:', data);
      if (userId) {
        const athlete = await getAthleteByGarminUserId(userId);
        if (athlete) {
          await prisma.athlete.update({
            where: { id: athlete.id },
            data: {
              garmin_is_connected: false,
              garmin_disconnected_at: new Date()
            }
          });
        }
      }
      break;
    case 'connection_status':
      console.log('🔌 Connection status changed:', data);
      // TODO: Update connection status
      break;
    case 'data_available':
      console.log('📦 New data available:', data);
      // TODO: Trigger data sync
      break;
    default:
      console.log('❓ Unknown webhook event type:', eventType);
  }
}


'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { formatDate } from '@/lib/utils/dates';
import { mpsToPaceString } from '@/lib/utils/pace';

const TEST_ATHLETE_ID = process.env.NEXT_PUBLIC_TEST_ATHLETE_ID || 'test-athlete-id';

interface Activity {
  id: string;
  activityName: string | null;
  startTime: Date | null;
  distance: number | null;
  averageSpeed: number | null;
  averageHeartRate: number | null;
  duration: number | null;
}

interface MatchData {
  dayId: string;
  plannedDay: {
    id: string;
    date: Date;
    plannedData: any;
  };
  activities: Activity[];
}

export default function MatchView() {
  const router = useRouter();
  const params = useParams();
  const dayId = params.dayId as string;
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    loadMatchData();
  }, [dayId]);

  async function loadMatchData() {
    try {
      const response = await fetch(`/api/training/match/${dayId}?athleteId=${TEST_ATHLETE_ID}`);
      if (!response.ok) {
        throw new Error('Failed to load match data');
      }
      const data = await response.json();
      setMatchData(data);
    } catch (error) {
      console.error('Error loading match data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleMatch(activityId: string) {
    try {
      setMatching(true);
      const response = await fetch(`/api/training/match/${dayId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId }),
      });

      if (!response.ok) {
        throw new Error('Failed to match activity');
      }

      const result = await response.json();
      
      // Show success message
      alert(`Workout matched! GoFastScore: ${Math.round(result.score.overallScore)}/100`);
      
      // Redirect back to day view
      router.push(`/training/day/${dayId}`);
    } catch (error) {
      console.error('Error matching activity:', error);
      alert('Failed to match activity');
    } finally {
      setMatching(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading activities...</div>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No match data found</p>
          <button
            onClick={() => router.back()}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { plannedDay, activities } = matchData;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-800 mb-4"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold mb-2">Match Workout</h1>
          <p className="text-gray-600">
            {formatDate(plannedDay.date)} - {plannedDay.plannedData?.label || 'Workout'}
          </p>
        </div>

        {/* Planned Workout Summary */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Planned Workout</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Distance</p>
              <p className="text-xl font-bold">{plannedDay.plannedData?.mileage || 'N/A'} mi</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Target Pace</p>
              <p className="text-xl font-bold">
                {plannedDay.plannedData?.paceRange || plannedDay.plannedData?.targetPace || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Activities List */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Select Activity to Match</h2>
          {activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No activities found for this day.</p>
              <p className="text-sm mt-2">Activities will appear here when synced from Garmin.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => handleMatch(activity.id)}
                  disabled={matching}
                  className="w-full bg-gray-50 hover:bg-gray-100 rounded-lg p-4 text-left transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold mb-1">
                        {activity.activityName || 'Running Activity'}
                      </p>
                      <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                          <p className="text-xs text-gray-500">Distance</p>
                          <p className="font-medium">
                            {activity.distance
                              ? (activity.distance / 1609.34).toFixed(2)
                              : 'N/A'}{' '}
                            mi
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Pace</p>
                          <p className="font-medium">
                            {activity.averageSpeed
                              ? `${mpsToPaceString(activity.averageSpeed)}/mi`
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">HR</p>
                          <p className="font-medium">
                            {activity.averageHeartRate || 'N/A'} bpm
                          </p>
                        </div>
                      </div>
                      {activity.startTime && (
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(activity.startTime).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="ml-4">
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
                        Select
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {matching && (
          <div className="mt-4 text-center text-gray-600">
            Matching activity and computing GoFastScore...
          </div>
        )}
      </div>
    </div>
  );
}


'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import { formatDate, isToday } from '@/lib/training/dates';
import { formatPace, mpsToPaceString } from '@/lib/utils/pace';

interface DayData {
  id: string;
  date: Date;
  weekIndex: number;
  dayIndex: number;
  phase: string;
  plannedData: any;
  executed: {
    id: string;
    activityId: string | null;
    analysis: any;
    feedback: any;
  } | null;
  activity: any;
  autoMatchCandidates: any[] | null;
}

export default function DayView() {
  const router = useRouter();
  const params = useParams();
  const dayId = params.dayId as string;
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDay();
  }, [dayId]);

  async function loadDay() {
    try {
      const response = await api.get(`/training/day/${dayId}`);
      setDayData(response.data);
    } catch (error: any) {
      console.error('Error loading day:', error);
      if (error.response?.status === 401) {
        router.push('/signup');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoMatch(activityId: string) {
    try {
      await api.post(`/training/match/${dayId}`, { activityId });

      // Reload day data
      await loadDay();
    } catch (error: any) {
      console.error('Error matching activity:', error);
      alert('Failed to match activity');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading workout...</div>
      </div>
    );
  }

  if (!dayData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Workout not found</p>
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

  const { plannedData, executed, activity, autoMatchCandidates } = dayData;
  const isRestDay = plannedData?.type === 'rest';

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
          <h1 className="text-3xl font-bold mb-2">
            {plannedData?.label || 'Workout'}
          </h1>
          <p className="text-gray-600">
            {formatDate(dayData.date)}
            {isToday(dayData.date) && (
              <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                Today
              </span>
            )}
          </p>
        </div>

        {isRestDay ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">😌</div>
            <h2 className="text-2xl font-bold mb-2">Rest Day</h2>
            <p className="text-gray-600">No workout scheduled. Enjoy your recovery!</p>
          </div>
        ) : (
          <>
            {/* Planned Workout */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Planned Workout</h2>
                  <p className="text-gray-600 capitalize">{plannedData?.type || 'workout'}</p>
                </div>
                {executed && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                    Completed
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Distance</p>
                  <p className="text-2xl font-bold">{plannedData?.mileage || 'N/A'} mi</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Target Pace</p>
                  <p className="text-2xl font-bold">
                    {formatPace(plannedData?.paceRange || plannedData?.targetPace)}
                  </p>
                </div>
              </div>

              {plannedData?.hrZone && (
                <div className="bg-orange-50 p-4 rounded-lg mb-4">
                  <p className="text-sm text-gray-600 mb-1">Heart Rate Zone {plannedData.hrZone}</p>
                  <p className="text-lg font-semibold">{plannedData.hrRange} bpm</p>
                </div>
              )}

              {plannedData?.description && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm font-semibold text-blue-900 mb-1">Coach's Notes</p>
                  <p className="text-sm text-blue-800">{plannedData.description}</p>
                </div>
              )}

              {/* Segments */}
              {plannedData?.segments && plannedData.segments.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-3">Workout Structure</h3>
                  <div className="space-y-2">
                    {plannedData.segments.map((seg: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                      >
                        <span className="font-medium capitalize">{seg.type}</span>
                        <span className="text-gray-600">
                          {seg.distance ? `${seg.distance} mi` : seg.duration ? `${seg.duration} min` : ''}
                          {seg.pace && ` @ ${seg.pace}`}
                          {seg.reps && ` × ${seg.reps}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actual Data */}
            {executed && activity && (
              <div className="bg-green-50 rounded-xl shadow-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-green-900 mb-4">Completed ✅</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-green-700 mb-1">Distance</p>
                    <p className="text-xl font-bold text-green-900">
                      {activity.distance ? (activity.distance / 1609.34).toFixed(2) : 'N/A'} mi
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-green-700 mb-1">Pace</p>
                    <p className="text-xl font-bold text-green-900">
                      {activity.averageSpeed
                        ? mpsToPaceString(activity.averageSpeed)
                        : 'N/A'}{' '}
                      /mi
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-green-700 mb-1">Avg HR</p>
                    <p className="text-xl font-bold text-green-900">
                      {activity.averageHeartRate || 'N/A'} bpm
                    </p>
                  </div>
                </div>

                {executed.analysis && (
                  <div className="mt-4 pt-4 border-t border-green-200">
                    <p className="text-sm font-semibold text-green-900 mb-2">GoFastScore</p>
                    <p className="text-2xl font-bold text-green-900">
                      {Math.round(executed.analysis.overallScore || 0)}/100
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Auto-Match Candidates */}
            {!executed && autoMatchCandidates && autoMatchCandidates.length > 0 && (
              <div className="bg-blue-50 rounded-xl shadow-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">
                  Found Matching Activity
                </h3>
                {autoMatchCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="bg-white rounded-lg p-4 mb-3 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-semibold">
                        {candidate.activityName || 'Running Activity'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {candidate.distance ? (candidate.distance / 1609.34).toFixed(2) : 'N/A'} mi
                        {candidate.averageSpeed && ` @ ${mpsToPaceString(candidate.averageSpeed)}/mi`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAutoMatch(candidate.id)}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 transition"
                    >
                      Match
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Match Workout Button */}
            {!executed && (
              <button
                onClick={() => router.push(`/training/match/${dayId}`)}
                className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition mb-4"
              >
                Match Workout
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}


'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { formatDate, isToday } from '@/lib/utils/dates';
import { formatPace } from '@/lib/utils/pace';

// TODO: Replace with actual auth
const TEST_ATHLETE_ID = process.env.NEXT_PUBLIC_TEST_ATHLETE_ID || 'test-athlete-id';

interface TodayWorkout {
  id: string;
  date: Date;
  plannedData: any;
  status: 'pending' | 'completed' | 'rest';
}

interface PlanStatus {
  hasPlan: boolean;
  totalWeeks: number;
  currentWeek: number;
  phase: string;
}

interface RaceReadiness {
  adaptive5k: string | null;
  goalDelta: string | null;
  status: 'on-track' | 'behind' | 'impossible';
}

export default function TrainingHub() {
  const router = useRouter();
  const [todayWorkout, setTodayWorkout] = useState<TodayWorkout | null>(null);
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [raceReadiness, setRaceReadiness] = useState<RaceReadiness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHubData();
  }, []);

  async function loadHubData() {
    try {
      const response = await fetch(`/api/training/hub?athleteId=${TEST_ATHLETE_ID}`);
      if (!response.ok) {
        throw new Error('Failed to load hub data');
      }
      const data = await response.json();
      
      setTodayWorkout(data.todayWorkout);
      setPlanStatus(data.planStatus);
      setRaceReadiness(data.raceReadiness);
    } catch (error) {
      console.error('Error loading hub data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Training Hub</h1>
          <p className="text-gray-600">
            Your central zone to track progress and stay on track
          </p>
        </div>

        {/* Today's Workout Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Today's Workout</h2>
          {todayWorkout ? (
            <div>
              {todayWorkout.status === 'rest' ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">😌</div>
                  <p className="text-gray-600">Rest Day - No workout scheduled</p>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {todayWorkout.plannedData?.label || 'Today\'s Workout'}
                      </h3>
                      <p className="text-gray-600 capitalize">
                        {todayWorkout.plannedData?.type || 'workout'}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        todayWorkout.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {todayWorkout.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Distance</p>
                      <p className="text-2xl font-bold">
                        {todayWorkout.plannedData?.mileage || 'N/A'} mi
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Target Pace</p>
                      <p className="text-2xl font-bold">
                        {formatPace(todayWorkout.plannedData?.paceRange || todayWorkout.plannedData?.targetPace)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/training/day/${todayWorkout.id}`)}
                    className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
                  >
                    View Workout Details
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No workout scheduled for today
            </div>
          )}
        </div>

        {/* Plan Status */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">See My Plan</h2>
          {planStatus?.hasPlan ? (
            <div>
              <p className="text-gray-600 mb-2">
                Week {planStatus.currentWeek + 1} of {planStatus.totalWeeks} - {planStatus.phase} Phase
              </p>
              <button
                onClick={() => router.push('/training/plan')}
                className="text-orange-600 hover:text-orange-700 font-semibold"
              >
                View Full Plan →
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-4">No active training plan</p>
              <button
                onClick={() => router.push('/training/plan/create')}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition"
              >
                Create Training Plan
              </button>
            </div>
          )}
        </div>

        {/* Race Readiness */}
        {raceReadiness && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Race Readiness Snapshot</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Adaptive 5K Time</p>
                <p className="text-2xl font-bold">
                  {raceReadiness.adaptive5k || 'N/A'}
                </p>
              </div>
              {raceReadiness.goalDelta && (
                <div>
                  <p className="text-sm text-gray-600">Goal Delta</p>
                  <p className="text-lg font-semibold">{raceReadiness.goalDelta}</p>
                </div>
              )}
              <div>
                <span
                  className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    raceReadiness.status === 'on-track'
                      ? 'bg-green-100 text-green-700'
                      : raceReadiness.status === 'behind'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {raceReadiness.status === 'on-track'
                    ? 'On Track'
                    : raceReadiness.status === 'behind'
                    ? 'Behind'
                    : 'Needs Attention'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/training/plan')}
            className="bg-white rounded-xl shadow-lg p-6 text-center hover:shadow-xl transition"
          >
            <div className="text-4xl mb-2">📅</div>
            <div className="font-semibold">View Plan</div>
          </button>
          <button
            onClick={() => router.push('/training/plan/0')}
            className="bg-white rounded-xl shadow-lg p-6 text-center hover:shadow-xl transition"
          >
            <div className="text-4xl mb-2">📊</div>
            <div className="font-semibold">This Week</div>
          </button>
        </div>
      </div>
    </div>
  );
}


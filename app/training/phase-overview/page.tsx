'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import PhaseOverviewCard from '@/components/training/PhaseOverviewCard';
import WeeklySummaryCard from '@/components/training/WeeklySummaryCard';
import { RUN_TYPES, getRunTypeConfig } from '@/lib/training/runTypes';

interface PhaseData {
  id: string;
  name: string;
  weekCount: number;
  phaseDescription: string | null;
  phaseTotalMilesTarget: number | null;
  phaseTotalMilesActual: number;
  longRunProgression: number[];
  qualityWorkoutsPerWeek: number;
  runTypesEnabled: any;
  weeks: Array<{
    id: string;
    weekNumber: number;
    miles: number | null;
    days: Array<{
      id: string;
      date: string;
      dayOfWeek: number;
      warmup: any[];
      workout: any[];
      cooldown: any[];
      notes: string | null;
    }>;
  }>;
}

// Helper to determine run type from day data
function determineRunType(day: PhaseData['weeks'][0]['days'][0]): 'easy' | 'tempo' | 'intervals' | 'longRun' | 'rest' {
  const totalMiles =
    day.warmup.reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) +
    day.workout.reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) +
    day.cooldown.reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0);

  if (totalMiles === 0) return 'rest';

  // Simple heuristics (can be improved later)
  if (totalMiles >= 10) return 'longRun';
  
  // Check workout structure for intervals (multiple short laps)
  const workoutLaps = day.workout.length;
  if (workoutLaps > 3 && day.workout.some((lap: any) => (lap.distanceMiles || 0) < 1)) {
    return 'intervals';
  }

  // Check pace goals for tempo
  const hasTempoPace = day.workout.some((lap: any) => lap.paceGoal && lap.paceGoal !== null);
  if (hasTempoPace && totalMiles >= 4) return 'tempo';

  return 'easy';
}

// Get day name from dayOfWeek (1=Monday, 7=Sunday)
function getDayName(dayOfWeek: number): string {
  const names = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return names[dayOfWeek] || '';
}

function PhaseOverviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phaseId = searchParams.get('phaseId');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phaseData, setPhaseData] = useState<PhaseData | null>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/signup');
        return;
      }

      if (!phaseId) {
        setError('Phase ID is required');
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/training/phase/${phaseId}`);
        if (response.data.success) {
          setPhaseData(response.data.phase);
          // Calculate current week (simplified - could use actual date)
          setCurrentWeekIndex(0); // Default to first week
        } else {
          setError(response.data.error || 'Failed to load phase');
        }
      } catch (err: any) {
        console.error('Load error:', err);
        setError(err.response?.data?.error || 'Failed to load phase');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, phaseId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl text-white">Loading phase overview...</p>
        </div>
      </div>
    );
  }

  if (error || !phaseData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl text-center">
          <p className="text-red-600 font-semibold mb-4">{error || 'Phase not found'}</p>
          <button
            onClick={() => router.push('/training')}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition"
          >
            Back to Training
          </button>
        </div>
      </div>
    );
  }

  // Build weekly summaries
  const weeklySummaries = phaseData.weeks.map((week) => {
    const days = week.days.map((day) => {
      const runType = determineRunType(day);
      const totalMiles =
        day.warmup.reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) +
        day.workout.reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) +
        day.cooldown.reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0);

      return {
        dayName: getDayName(day.dayOfWeek),
        runType,
        distance: totalMiles,
      };
    });

    const totalDistance = days.reduce((sum, day) => sum + day.distance, 0);

    // Calculate week date range
    const weekDates = week.days.length > 0
      ? {
          start: new Date(week.days[0].date),
          end: new Date(week.days[week.days.length - 1].date),
        }
      : { start: new Date(), end: new Date() };

    return {
      weekNumber: week.weekNumber,
      weekDates,
      days,
      totalDistance,
    };
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Phase Overview</h1>
          <button
            onClick={() => router.push(`/training/phase-config?phaseId=${phaseId}`)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Configure Phase
          </button>
        </div>

        {/* Phase Overview Card */}
        <PhaseOverviewCard
          phaseName={phaseData.name}
          phaseDescription={phaseData.phaseDescription}
          phaseTotalMilesTarget={phaseData.phaseTotalMilesTarget}
          phaseTotalMilesActual={phaseData.phaseTotalMilesActual}
          longRunProgression={phaseData.longRunProgression}
          weekCount={phaseData.weekCount}
          currentWeek={currentWeekIndex + 1}
        />

        {/* Weekly Summaries */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Weekly Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {weeklySummaries.map((summary) => (
              <WeeklySummaryCard
                key={summary.weekNumber}
                weekNumber={summary.weekNumber}
                weekDates={summary.weekDates}
                days={summary.days}
                totalDistance={summary.totalDistance}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PhaseOverviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl text-white">Loading...</p>
        </div>
      </div>
    }>
      <PhaseOverviewContent />
    </Suspense>
  );
}


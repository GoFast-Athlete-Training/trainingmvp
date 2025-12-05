'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import { getDayName, formatDate, isToday } from '@/lib/training/dates';
import WeeklySummaryCard from '@/components/training/WeeklySummaryCard';
import { getRunTypeConfig } from '@/lib/training/runTypes';

interface Day {
  id: string;
  dayOfWeek: number;
  date: string;
  phase: string;
  warmup: any[];
  workout: any[];
  cooldown: any[];
  notes: string | null;
  status: 'pending' | 'completed' | 'rest';
}

interface Week {
  weekNumber: number;
  phase: string;
  days: Day[];
}

export default function WeekView() {
  const router = useRouter();
  const params = useParams();
  const weekIndex = parseInt(params.weekIndex as string);
  const [week, setWeek] = useState<Week | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isNaN(weekIndex)) {
      loadWeek();
    }
  }, [weekIndex]);

  async function loadWeek() {
    try {
      const response = await api.get(`/training/plan/${weekIndex}`);
      setWeek(response.data);
    } catch (error: any) {
      console.error('Error loading week:', error);
      if (error.response?.status === 401) {
        router.push('/signup');
      }
    } finally {
      setLoading(false);
    }
  }

  // Helper to determine run type from day data
  function determineRunType(day: Day): 'easy' | 'tempo' | 'intervals' | 'longRun' | 'rest' {
    if (day.status === 'rest') return 'rest';

    const totalMiles =
      (day.warmup || []).reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) +
      (day.workout || []).reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) +
      (day.cooldown || []).reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0);

    if (totalMiles === 0) return 'rest';
    if (totalMiles >= 10) return 'longRun';

    // Check workout structure for intervals (multiple short laps)
    const workoutLaps = (day.workout || []).length;
    if (workoutLaps > 3 && (day.workout || []).some((lap: any) => (lap.distanceMiles || 0) < 1)) {
      return 'intervals';
    }

    // Check pace goals for tempo
    const hasTempoPace = (day.workout || []).some((lap: any) => lap.paceGoal && lap.paceGoal !== null);
    if (hasTempoPace && totalMiles >= 4) return 'tempo';

    return 'easy';
  }

  // Build weekly summary data
  function buildWeeklySummary(): {
    weekNumber: number;
    weekDates: { start: Date; end: Date };
    days: Array<{ dayName: string; runType: 'easy' | 'tempo' | 'intervals' | 'longRun' | 'rest'; distance: number }>;
    totalDistance: number;
  } | null {
    if (!week || !week.days || week.days.length === 0) return null;

    const days = week.days.map((day) => {
      const runType = determineRunType(day);
      const totalMiles =
        (day.warmup || []).reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) +
        (day.workout || []).reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) +
        (day.cooldown || []).reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0);

      return {
        dayName: getDayName(day.dayOfWeek),
        runType,
        distance: totalMiles,
      };
    });

    const totalDistance = days.reduce((sum, day) => sum + day.distance, 0);

    const weekDates = {
      start: new Date(week.days[0].date),
      end: new Date(week.days[week.days.length - 1].date),
    };

    return {
      weekNumber: week.weekNumber,
      weekDates,
      days,
      totalDistance,
    };
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading week...</div>
      </div>
    );
  }

  if (!week) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Week not found</p>
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

  const weeklySummary = buildWeeklySummary();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-800 mb-4"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold mb-2">
            Week {week.weekNumber} - {week.phase.charAt(0).toUpperCase() + week.phase.slice(1)} Phase
          </h1>
        </div>

        {/* Weekly Summary Card (RUNNA-style) */}
        {weeklySummary && (
          <div className="mb-8">
            <WeeklySummaryCard
              weekNumber={weeklySummary.weekNumber}
              weekDates={weeklySummary.weekDates}
              days={weeklySummary.days}
              totalDistance={weeklySummary.totalDistance}
            />
          </div>
        )}

        {/* Days Grid */}
        <div className="space-y-3">
          {week.days.map((day) => {
            const runType = determineRunType(day);
            const runConfig = getRunTypeConfig(runType);
            const totalMiles =
              (day.warmup || []).reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) +
              (day.workout || []).reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) +
              (day.cooldown || []).reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0);

            return (
              <button
                key={day.id}
                onClick={() => router.push(`/training/day/${day.id}`)}
                className={`w-full bg-white rounded-xl shadow-lg p-6 text-left hover:shadow-xl transition ${
                  isToday(new Date(day.date)) ? 'ring-2 ring-orange-500' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">
                        {getDayName(day.dayOfWeek)}
                      </h3>
                      <span className="text-sm text-gray-500">
                        {formatDate(new Date(day.date))}
                      </span>
                      {isToday(new Date(day.date)) && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                          Today
                        </span>
                      )}
                    </div>

                    {day.status === 'rest' ? (
                      <p className="text-gray-500">Rest Day</p>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{
                            backgroundColor: runConfig.bgColor,
                            color: runConfig.color,
                            border: `1px solid ${runConfig.borderColor}`,
                          }}
                        >
                          {runConfig.label}
                        </span>
                        <span className="text-gray-700 font-semibold">
                          {totalMiles.toFixed(1)} mi
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="ml-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        day.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : day.status === 'rest'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {day.status}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


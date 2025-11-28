'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import { getDayName, formatDate, isToday } from '@/lib/utils/dates';
import { formatPace } from '@/lib/utils/pace';

interface Day {
  id: string;
  dayIndex: number;
  date: Date;
  phase: string;
  plannedData: any;
  status: 'pending' | 'completed' | 'rest';
}

interface Week {
  weekIndex: number;
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
            Week {week.weekIndex + 1} - {week.phase.charAt(0).toUpperCase() + week.phase.slice(1)} Phase
          </h1>
        </div>

        {/* Days Grid */}
        <div className="space-y-3">
          {week.days.map((day) => (
            <button
              key={day.id}
              onClick={() => router.push(`/training/day/${day.id}`)}
              className={`w-full bg-white rounded-xl shadow-lg p-6 text-left hover:shadow-xl transition ${
                isToday(day.date) ? 'ring-2 ring-orange-500' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">
                      {getDayName(day.dayIndex)}
                    </h3>
                    <span className="text-sm text-gray-500">
                      {formatDate(day.date)}
                    </span>
                    {isToday(day.date) && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                        Today
                      </span>
                    )}
                  </div>

                  {day.status === 'rest' ? (
                    <p className="text-gray-500">Rest Day</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Type</p>
                        <p className="font-semibold capitalize">
                          {day.plannedData?.type || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Mileage</p>
                        <p className="font-semibold">
                          {day.plannedData?.mileage || 'N/A'} mi
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Pace</p>
                        <p className="font-semibold">
                          {formatPace(day.plannedData?.paceRange || day.plannedData?.targetPace)}
                        </p>
                      </div>
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
          ))}
        </div>
      </div>
    </div>
  );
}


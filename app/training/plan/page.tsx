'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface Phase {
  name: string;
  startWeek: number;
  endWeek: number;
  weeks: number[];
}

interface PlanOverview {
  id: string;
  name: string;
  totalWeeks: number;
  phases: Phase[];
  weeklyMileage: number[];
}

export default function PlanOverview() {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlan();
  }, []);

  async function loadPlan() {
    try {
      const response = await api.get('/training/plan');
      setPlan(response.data);
    } catch (error: any) {
      console.error('Error loading plan:', error);
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
        <div className="text-xl">Loading plan...</div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No training plan found</p>
          <button
            onClick={() => router.push('/training/plan/create')}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition"
          >
            Create Training Plan
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
          <h1 className="text-3xl font-bold mb-2">Training Plan Overview</h1>
          <p className="text-gray-600">{plan.name}</p>
        </div>

        {/* Phases */}
        <div className="space-y-6">
          {plan.phases.map((phase, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold capitalize">{phase.name} Phase</h2>
                <span className="text-sm text-gray-600">
                  Weeks {phase.startWeek + 1} - {phase.endWeek + 1}
                </span>
              </div>

              {/* Weeks in Phase */}
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                {phase.weeks.map((weekIndex) => (
                  <button
                    key={weekIndex}
                    onClick={() => router.push(`/training/plan/${weekIndex}`)}
                    className="bg-gray-100 hover:bg-orange-100 rounded-lg p-3 text-center transition"
                  >
                    <div className="font-semibold">W{weekIndex + 1}</div>
                    {plan.weeklyMileage[weekIndex] && (
                      <div className="text-xs text-gray-600">
                        {plan.weeklyMileage[weekIndex]} mi
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


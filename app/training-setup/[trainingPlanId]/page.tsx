'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';

export default function TrainingSetupGoalTimePage() {
  const router = useRouter();
  const params = useParams();
  const trainingPlanId = params.trainingPlanId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [goalTime, setGoalTime] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/signup');
        return;
      }

      // Load plan from database
      try {
        const response = await api.get(`/training-plan/${trainingPlanId}`);
        if (response.data.success) {
          setPlan(response.data.trainingPlan);
          if (response.data.trainingPlan.trainingPlanGoalTime) {
            setGoalTime(response.data.trainingPlan.trainingPlanGoalTime);
          }
        } else {
          setError(response.data.error || 'Failed to load plan');
        }
      } catch (err: any) {
        console.error('Load plan error:', err);
        setError(err.response?.data?.error || 'Failed to load plan');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, trainingPlanId]);

  const handleSave = async () => {
    if (!goalTime.trim()) {
      setError('Goal time is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await api.post('/training-plan/update', {
        trainingPlanId,
        updates: {
          trainingPlanGoalTime: goalTime,
        },
      });

      if (response.data.success) {
        // For MVP1, skip preferred days and go to review
        router.push(`/training-setup/${trainingPlanId}/review`);
      } else {
        setError(response.data.error || 'Failed to save goal time');
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.response?.data?.error || 'Failed to save goal time');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl text-center">
          <p className="text-red-600 font-semibold mb-4">{error || 'Plan not found'}</p>
          <button
            onClick={() => router.push('/training-setup/start')}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition"
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-2xl">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
            Set Your Goal Time 🎯
          </h1>
          <p className="text-gray-600 mb-8">
            What's your goal time for {plan.race?.name || 'this race'}?
          </p>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
              <p className="font-semibold">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Goal Time *
              </label>
              <input
                type="text"
                value={goalTime}
                onChange={(e) => setGoalTime(e.target.value)}
                placeholder="e.g., 3:30:00 (HH:MM:SS) or 25:00 (MM:SS)"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg"
              />
              <p className="text-sm text-gray-500 mt-1">
                Format: HH:MM:SS for longer races, MM:SS for shorter races
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => router.push('/training-setup/start')}
                className="flex-1 bg-gray-100 text-gray-700 py-4 px-6 rounded-xl font-semibold hover:bg-gray-200 transition"
              >
                ← Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !goalTime.trim()}
                className="flex-1 bg-orange-500 text-white py-4 px-6 rounded-xl font-semibold hover:bg-orange-600 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Continue →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


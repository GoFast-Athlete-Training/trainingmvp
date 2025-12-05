'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';

export default function TrainingSetupBaselinePage() {
  const router = useRouter();
  const params = useParams();
  const trainingPlanId = params.trainingPlanId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<any>(null);
  
  // Form state
  const [fiveKPace, setFiveKPace] = useState('');
  const [fiveKPaceMinutes, setFiveKPaceMinutes] = useState('');
  const [fiveKPaceSeconds, setFiveKPaceSeconds] = useState('');
  const [weeklyMileage, setWeeklyMileage] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/signup');
        return;
      }

      // Load plan and fitness data
      try {
        // Load plan - required
        const planResponse = await api.get(`/training-plan/${trainingPlanId}`);

        if (planResponse.data.success) {
          setPlan(planResponse.data.trainingPlan);
          
          // Pre-fill with existing values if set on plan
          if (planResponse.data.trainingPlan.current5KPace) {
            const paceParts = planResponse.data.trainingPlan.current5KPace.split(':');
            if (paceParts.length === 2) {
              setFiveKPaceMinutes(paceParts[0]);
              setFiveKPaceSeconds(paceParts[1]);
              setFiveKPace(planResponse.data.trainingPlan.current5KPace);
            }
          }
          if (planResponse.data.trainingPlan.currentWeeklyMileage) {
            setWeeklyMileage(planResponse.data.trainingPlan.currentWeeklyMileage.toString());
          }
        }

        // Try to load fitness data - it's ok if this fails or is null
        try {
          const fitnessResponse = await api.get('/athlete/fitness');
          if (fitnessResponse.data?.success && fitnessResponse.data?.fitness) {
            // Pre-fill 5K pace from athlete fitness if available and not already set on plan
            const athleteFiveKPace = fitnessResponse.data.fitness?.fiveKPace;
            if (athleteFiveKPace && !planResponse.data?.trainingPlan?.current5KPace) {
              const paceParts = athleteFiveKPace.split(':');
              if (paceParts.length === 2) {
                setFiveKPaceMinutes(paceParts[0]);
                setFiveKPaceSeconds(paceParts[1]);
                setFiveKPace(athleteFiveKPace);
              }
            }
          }
        } catch (fitnessErr) {
          // It's totally fine if fitness data doesn't exist or fetch fails
          console.log('No fitness data available, user will input their own');
        }
      } catch (err: any) {
        console.error('Load error:', err);
        setError(err.response?.data?.error || 'Failed to load training plan');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, trainingPlanId]);

  // Update pace string when minutes/seconds change
  useEffect(() => {
    if (fiveKPaceMinutes && fiveKPaceSeconds) {
      const minutes = fiveKPaceMinutes.padStart(2, '0');
      const seconds = fiveKPaceSeconds.padStart(2, '0');
      setFiveKPace(`${minutes}:${seconds}`);
    }
  }, [fiveKPaceMinutes, fiveKPaceSeconds]);

  const handleSave = async () => {
    if (!fiveKPaceMinutes || !fiveKPaceSeconds || !weeklyMileage) {
      setError('Please fill in all fields');
      return;
    }

    const mileageNum = parseInt(weeklyMileage);
    if (isNaN(mileageNum) || mileageNum < 0) {
      setError('Weekly mileage must be a valid number');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Update training plan with baseline metrics
      const response = await api.post('/training-plan/update', {
        trainingPlanId,
        updates: {
          current5KPace: fiveKPace,
          currentWeeklyMileage: mileageNum,
        },
      });

      if (response.data.success) {
        // Also update athlete fitness with 5K pace
        try {
          await api.put('/athlete/fitness', {
            fiveKPace: fiveKPace,
          });
        } catch (err) {
          console.warn('Failed to update athlete fitness:', err);
          // Don't fail the whole flow if athlete update fails
        }
        
        // Route to preferences page
        router.push(`/training-setup/${trainingPlanId}/preferences`);
      } else {
        setError(response.data.error || 'Failed to save baseline metrics');
        setSaving(false);
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.response?.data?.error || 'Failed to save baseline metrics');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              🏃‍♂️ Set Your Baseline
            </h1>
            <p className="text-gray-600">
              Tell us where you're starting so we can build your plan gradually
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Current 5K Pace */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                What's your current 5K pace? *
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Minutes</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={fiveKPaceMinutes}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                        setFiveKPaceMinutes(val);
                      }
                    }}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg text-center"
                  />
                </div>
                <div className="pt-6 text-2xl font-bold text-gray-400">:</div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Seconds</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={fiveKPaceSeconds}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                        setFiveKPaceSeconds(val);
                      }
                    }}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg text-center"
                  />
                </div>
                <div className="pt-6 text-sm text-gray-600 font-semibold">/mile</div>
              </div>
              {fiveKPace && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-semibold text-blue-800">Your 5K pace:</p>
                  <p className="text-lg font-bold text-blue-900">{fiveKPace} /mile</p>
                </div>
              )}
            </div>

            {/* Current Weekly Mileage */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                What's your current weekly mileage? *
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min="0"
                  max="200"
                  value={weeklyMileage}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 200)) {
                      setWeeklyMileage(val);
                    }
                  }}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg"
                />
                <div className="text-sm text-gray-600 font-semibold">miles/week</div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-8">
            <button
              onClick={() => router.push(`/training-setup/${trainingPlanId}`)}
              className="flex-1 bg-gray-100 text-gray-700 py-4 px-6 rounded-xl font-semibold hover:bg-gray-200 transition"
            >
              ← Back
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !fiveKPaceMinutes || !fiveKPaceSeconds || !weeklyMileage}
              className="flex-1 bg-orange-500 text-white py-4 px-6 rounded-xl font-semibold hover:bg-orange-600 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


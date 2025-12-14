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
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/signup');
        return;
      }

      // Load plan from database
      try {
        const response = await api.get(`/training-plan/${trainingPlanId}`);
        console.log('📋 GOAL TIME: Plan loaded:', response.data);
        if (response.data.success) {
          const planData = response.data.trainingPlan;
          
          // Check if race is attached
          if (!planData.race) {
            console.warn('⚠️ GOAL TIME: No race attached to plan, redirecting to race selection');
            router.push(`/training-setup/start?planId=${trainingPlanId}`);
            return;
          }
          
          setPlan(planData);
          
          if (planData.goalTime) {
            const timeStr = planData.goalTime;
            setGoalTime(timeStr);
            // Parse existing time into components
            const parts = timeStr.split(':');
            if (parts.length === 3) {
              setHours(parts[0]);
              setMinutes(parts[1]);
              setSeconds(parts[2]);
            } else if (parts.length === 2) {
              setHours('');
              setMinutes(parts[0]);
              setSeconds(parts[1]);
            }
          }
          
          // Set race type for validation (API returns 'race' not 'race_registry')
          const race = planData.race;
          if (race) {
            const raceType = race.raceType || race.distance;
            setPlan((prev: any) => ({
              ...prev,
              race: {
                ...race,
                raceType: raceType,
              },
              race_registry: race, // Also set for backward compat
            }));
          }
        } else {
          setError(response.data.error || 'Failed to load plan');
        }
      } catch (err: any) {
        console.error('❌ GOAL TIME: Load plan error:', err);
        setError(err.response?.data?.error || 'Failed to load plan');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, trainingPlanId]);

  // Update goalTime string when components change
  useEffect(() => {
    const race = plan?.race || plan?.race_registry;
    const raceType = race?.raceType?.toLowerCase() || race?.distance?.toLowerCase();
    const isLongRace = raceType === 'marathon' || raceType === 'half';
    
    if (isLongRace) {
      // For long races, always use HH:MM:SS
      const h = hours.padStart(2, '0') || '0';
      const m = minutes.padStart(2, '0') || '0';
      const s = seconds.padStart(2, '0') || '0';
      setGoalTime(`${h}:${m}:${s}`);
    } else {
      // For short races, use MM:SS if hours is empty, otherwise HH:MM:SS
      if (!hours || hours === '0') {
        const m = minutes.padStart(2, '0') || '0';
        const s = seconds.padStart(2, '0') || '0';
        setGoalTime(`${m}:${s}`);
      } else {
        const h = hours.padStart(2, '0');
        const m = minutes.padStart(2, '0') || '0';
        const s = seconds.padStart(2, '0') || '0';
        setGoalTime(`${h}:${m}:${s}`);
      }
    }
  }, [hours, minutes, seconds, plan?.race?.distance || plan?.race_registry?.distance]);

  const handleSave = async () => {
    const race = plan?.race || plan?.race_registry;
    const raceType = race?.raceType?.toLowerCase() || race?.distance?.toLowerCase();
    const isLongRace = raceType === 'marathon' || raceType === 'half';
    
    // Validate inputs
    if (isLongRace) {
      if (!hours || !minutes || !seconds) {
        setError('Please enter hours, minutes, and seconds');
        return;
      }
      const h = parseInt(hours);
      const m = parseInt(minutes);
      const s = parseInt(seconds);
      if (isNaN(h) || isNaN(m) || isNaN(s) || m >= 60 || s >= 60) {
        setError('Invalid time. Minutes and seconds must be less than 60.');
        return;
      }
    } else {
      if (!minutes || !seconds) {
        setError('Please enter minutes and seconds');
        return;
      }
      const m = parseInt(minutes);
      const s = parseInt(seconds);
      if (isNaN(m) || isNaN(s) || m >= 60 || s >= 60) {
        setError('Invalid time. Minutes and seconds must be less than 60.');
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const response = await api.post('/training-plan/update', {
        trainingPlanId,
        updates: {
          goalTime: goalTime.trim(),
        },
      });

      if (response.data.success) {
        // For MVP1, skip preferred days and go to review
        router.push(`/training-setup/${trainingPlanId}/baseline`);
      } else {
        setError(response.data.error || 'Failed to save goal time');
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.response?.data?.error || err.response?.data?.details || 'Failed to save goal time');
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
            What's your goal time for {(plan.race || plan.race_registry)?.name || 'this race'}?
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
              
              {(() => {
                const race = plan?.race || plan?.race_registry;
                const raceType = race?.raceType?.toLowerCase() || race?.distance?.toLowerCase();
                return raceType === 'marathon' || raceType === 'half';
              })() ? (
                // Long race: HH:MM:SS format
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Hours</label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={hours}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 23)) {
                          setHours(val);
                        }
                      }}
                      placeholder="3"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg text-center"
                    />
                  </div>
                  <div className="pt-6 text-2xl font-bold text-gray-400">:</div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Minutes</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={minutes}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                          setMinutes(val);
                        }
                      }}
                      placeholder="30"
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
                      value={seconds}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                          setSeconds(val);
                        }
                      }}
                      placeholder="00"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg text-center"
                    />
                  </div>
                </div>
              ) : (
                // Short race: MM:SS format (with optional hours)
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Hours (optional)</label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={hours}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 23)) {
                            setHours(val);
                          }
                        }}
                        placeholder="0"
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg text-center"
                      />
                    </div>
                    <div className="pt-6 text-2xl font-bold text-gray-400">:</div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Minutes</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={minutes}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                            setMinutes(val);
                          }
                        }}
                        placeholder="25"
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
                        value={seconds}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                            setSeconds(val);
                          }
                        }}
                        placeholder="00"
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg text-center"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm font-semibold text-orange-800 mb-1">Preview:</p>
                <p className="text-lg font-bold text-orange-900">
                  {goalTime || 'Enter time above'}
                </p>
              </div>
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
                disabled={saving || !goalTime.trim() || (!minutes || !seconds)}
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


'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { paceToString } from '@/lib/training/pace-prediction';
import { calculateGoalRacePace } from '@/lib/training/goal-race-pace';

// Format race date properly (handle timezone issues)
// Race dates are date-only values, so we use UTC to prevent timezone shifts
function formatRaceDate(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', dateString);
      return 'Invalid date';
    }
    
    // Use UTC methods to prevent timezone shifts (race dates are date-only)
    // This ensures "2026-04-20" always displays as 4/20/2026 regardless of user's timezone
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    
    return `${month}/${day}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', dateString, error);
    return 'Invalid date';
  }
}

export default function TrainingSetupReviewPage() {
  const router = useRouter();
  const params = useParams();
  const trainingPlanId = params.trainingPlanId as string;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null); // Generated plan from AI
  const [startDate, setStartDate] = useState('');
  const [weeksUntilRace, setWeeksUntilRace] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

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
          const loadedPlan = response.data.trainingPlan;
          console.log('📋 REVIEW: Loaded plan data:', {
            preferredDays: loadedPlan.preferredDays,
            current5KPace: loadedPlan.current5KPace,
            currentWeeklyMileage: loadedPlan.currentWeeklyMileage,
          });
          setPlan(loadedPlan);
          
          // Set start date if already set, otherwise default to today
          if (loadedPlan.startDate) {
            // Parse date and use UTC methods to prevent timezone shifts
            // Dates stored in DB are date-only, so we use UTC to get the exact date
            const start = new Date(loadedPlan.startDate);
            const year = start.getUTCFullYear();
            const month = String(start.getUTCMonth() + 1).padStart(2, '0');
            const day = String(start.getUTCDate()).padStart(2, '0');
            setStartDate(`${year}-${month}-${day}`);
          } else {
            // Default to today (use local date - user's actual today)
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;
            console.log('📅 REVIEW: Setting default start date to today:', todayStr, '(local date)');
            setStartDate(todayStr);
          }
          
          // Calculate weeks until race if race date exists
          if (loadedPlan.race?.date) {
            calculateWeeksUntilRace(loadedPlan.race.date, loadedPlan.startDate || new Date());
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

  // Calculate weeks from start date to race date
  const calculateWeeksUntilRace = (raceDate: string | Date, startDateInput: string | Date) => {
    try {
      const race = typeof raceDate === 'string' ? new Date(raceDate) : raceDate;
      const start = typeof startDateInput === 'string' ? new Date(startDateInput) : startDateInput;
      
      // Normalize to UTC midnight
      race.setUTCHours(0, 0, 0, 0);
      start.setUTCHours(0, 0, 0, 0);
      
      const diffMs = race.getTime() - start.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const weeks = Math.floor(diffDays / 7);
      
      setWeeksUntilRace(weeks);
      
      // Warn if less than 16 weeks
      if (weeks < 16) {
        setWarning(`⚠️ Your training plan is only ${weeks} weeks. We recommend at least 16 weeks for optimal race preparation.`);
      } else {
        setWarning(null);
      }
    } catch (error) {
      console.error('Error calculating weeks:', error);
      setWeeksUntilRace(null);
    }
  };

  // Handle start date change
  const handleStartDateChange = (dateStr: string) => {
    setStartDate(dateStr);
    if (plan?.race?.date) {
      calculateWeeksUntilRace(plan.race.date, dateStr);
    }
  };

  const handleGenerate = async () => {
    if (!startDate) {
      setError('Please select a start date');
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedPlan(null); // Clear previous generation

    try {
      // First, ALWAYS update the plan with the start date (required before generation)
      const startDateObj = new Date(startDate);
      startDateObj.setUTCHours(0, 0, 0, 0);
      
      // Calculate total weeks if race date exists
      let calculatedWeeks = plan?.totalWeeks || 16; // Default to 16 if no race date
      if (plan?.race?.date) {
        const raceDate = new Date(plan.race.date);
        raceDate.setUTCHours(0, 0, 0, 0);
        const diffMs = raceDate.getTime() - startDateObj.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        calculatedWeeks = Math.max(8, Math.floor(diffDays / 7));
      }
      
      // ALWAYS update plan with start date (and weeks if calculated)
      const updateResponse = await api.post('/training-plan/update', {
        trainingPlanId,
        updates: {
          startDate: startDateObj.toISOString(),
          totalWeeks: calculatedWeeks,
        },
      });

      if (!updateResponse.data.success) {
        setError(updateResponse.data.error || 'Failed to update plan with start date');
        setGenerating(false);
        return;
      }
      
      // Wait a moment to ensure database transaction commits
      await new Promise(resolve => setTimeout(resolve, 100));

      // Generate the plan (returns plan for review, doesn't save)
      console.log('🔄 REVIEW: Calling generate endpoint...');
      const response = await api.post('/training-plan/generate', {
        trainingPlanId,
      });

      console.log('📋 REVIEW: Generate response:', {
        success: response.data.success,
        hasPlan: !!response.data.plan,
        planKeys: response.data.plan ? Object.keys(response.data.plan) : [],
      });

      if (response.data.success) {
        if (response.data.plan) {
          setGeneratedPlan(response.data.plan);
          console.log('✅ REVIEW: Plan set for review:', {
            phases: response.data.plan.phases?.length,
            hasWeek: !!response.data.plan.week,
          });
        } else {
          setError('Plan generated but no plan data returned');
        }
      } else {
        setError(response.data.error || response.data.details || 'Failed to generate plan');
      }
    } catch (err: any) {
      console.error('❌ REVIEW: Generate error:', err);
      console.error('❌ REVIEW: Error response:', err.response?.data);
      setError(err.response?.data?.error || err.response?.data?.details || 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirm = async () => {
    if (!generatedPlan) {
      setError('No plan to confirm');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Confirm and save the plan
      const response = await api.put('/training-plan/generate', {
        trainingPlanId,
        plan: generatedPlan,
      });

      if (response.data.success) {
        router.push(`/training?planId=${trainingPlanId}`);
      } else {
        setError(response.data.error || response.data.details || 'Failed to save plan');
      }
    } catch (err: any) {
      console.error('Confirm error:', err);
      setError(err.response?.data?.error || err.response?.data?.details || 'Failed to save plan');
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
            Review & Generate ✨
          </h1>
          <p className="text-gray-600 mb-8">
            Review your plan details and generate your training plan
          </p>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
              <p className="font-semibold">{error}</p>
            </div>
          )}

          <div className="space-y-6 mb-8">
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="space-y-4">
                {/* Race Section */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-600">Race</p>
                    <p className="text-lg font-bold text-gray-800">
                      {plan.race?.name || 'Not set'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {plan.race?.raceType?.toUpperCase() || plan.race?.distance?.toUpperCase()} {plan.race?.miles ? `(${plan.race.miles} miles)` : ''} • {plan.race?.date ? formatRaceDate(plan.race.date) : 'Unknown date'}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/training-setup/start?planId=${trainingPlanId}`)}
                    className="ml-4 text-orange-600 hover:text-orange-700 text-sm font-semibold underline"
                  >
                    Edit
                  </button>
                </div>

                {/* Goal Time Section */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-600">Goal Time</p>
                    <p className="text-lg font-bold text-gray-800">
                      {plan.goalTime || 'Not set'}
                    </p>
                    {/* Goal Race Pace - Show right under goal time */}
                    {plan.goalTime && plan.race?.miles && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500">Goal Pace:</p>
                        <p className="text-lg font-bold text-orange-600">
                          {(() => {
                            try {
                              // Use stored value if available, otherwise calculate on the fly
                              if (plan.goalRacePace) {
                                return paceToString(plan.goalRacePace);
                              }
                              // Fallback: calculate from goal time and race miles
                              const goalPaceSec = calculateGoalRacePace(plan.goalTime, plan.race.miles);
                              return paceToString(goalPaceSec);
                            } catch (error) {
                              console.error('Error calculating goal pace:', error);
                              return 'Unable to calculate';
                            }
                          })()} /mile
                        </p>
                      </div>
                    )}
                  </div>
                  {plan.goalTime && (
                    <button
                      onClick={() => router.push(`/training-setup/${trainingPlanId}`)}
                      className="ml-4 text-orange-600 hover:text-orange-700 text-sm font-semibold underline"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {/* Current 5K Pace Section */}
                {plan.current5KPace && (
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Current 5K Pace</p>
                    <p className="text-lg font-bold text-blue-600">
                      {plan.current5KPace} /mile
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Your current fitness level</p>
                  </div>
                )}

                {/* Predicted Race Pace Section */}
                {plan.predictedRacePace && (
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Predicted Race Pace</p>
                    <p className="text-lg font-bold text-green-600">
                      {paceToString(plan.predictedRacePace)} /mile
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Based on your current 5K pace</p>
                  </div>
                )}

                {/* Preferred Training Days Section */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-600">Preferred Training Days</p>
                    {plan.preferredDays && plan.preferredDays.length > 0 ? (
                      <p className="text-lg font-bold text-gray-800">
                        {(() => {
                          const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                          return plan.preferredDays
                            .sort((a: number, b: number) => a - b)
                            .map((d: number) => dayNames[d])
                            .join('/');
                        })()}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 mt-1 italic">Not set</p>
                    )}
                  </div>
                  <button
                    onClick={() => router.push(`/training-setup/${trainingPlanId}/preferences`)}
                    className="ml-4 text-orange-600 hover:text-orange-700 text-sm font-semibold underline"
                  >
                    Edit
                  </button>
                </div>

                {/* Weeks Until Race (calculated, read-only) */}
                {weeksUntilRace !== null && (
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Weeks Until Race</p>
                    <p className={`text-lg font-bold ${weeksUntilRace < 16 ? 'text-orange-600' : 'text-gray-800'}`}>
                      {weeksUntilRace} weeks
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Start Date Selection */}
            <div className="bg-white rounded-xl p-6 border-2 border-orange-200">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-gray-700">
                  When do you want to start training? *
                </label>
                <span className="text-xs text-gray-500">Editable</span>
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                min={(() => {
                  // Use local date (not UTC) for min to avoid timezone issues
                  const today = new Date();
                  const year = today.getFullYear();
                  const month = String(today.getMonth() + 1).padStart(2, '0');
                  const day = String(today.getDate()).padStart(2, '0');
                  return `${year}-${month}-${day}`;
                })()}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg"
              />
              {warning && (
                <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-sm text-orange-800">{warning}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => router.push(`/training-setup/${trainingPlanId}/preferences`)}
              className="flex-1 bg-gray-100 text-gray-700 py-4 px-6 rounded-xl font-semibold hover:bg-gray-200 transition"
            >
              ← Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={
                generating || 
                saving ||
                !plan.goalTime || 
                !startDate || 
                !plan.race ||
                !plan.current5KPace ||
                !plan.currentWeeklyMileage ||
                !plan.preferredDays ||
                plan.preferredDays.length < 5
              }
              className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 px-6 rounded-xl font-bold hover:from-orange-600 hover:to-red-600 transition disabled:opacity-50 shadow-lg"
            >
              {generating ? 'Generating...' : generatedPlan ? 'Regenerate Plan' : 'Generate Preview →'}
            </button>
          </div>

          {/* Validation Messages */}
          {(!plan.race || !plan.goalTime || !startDate || !plan.current5KPace || !plan.currentWeeklyMileage || !plan.preferredDays || plan.preferredDays.length < 5) && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-yellow-800 mb-2">Please complete all required fields:</p>
              <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
                {!plan.race && <li>Select a race (click Edit next to Race above)</li>}
                {!plan.goalTime && <li>Set your goal time (click Edit next to Goal Time above)</li>}
                {!plan.current5KPace && <li>Set your baseline 5K pace (go back to Set Baseline step)</li>}
                {!plan.currentWeeklyMileage && <li>Set your current weekly mileage (go back to Set Baseline step)</li>}
                {(!plan.preferredDays || plan.preferredDays.length < 5) && <li>Set your preferred training days - at least 5 days required (go back to Preferences step)</li>}
                {!startDate && <li>Choose your start date</li>}
              </ul>
            </div>
          )}

          {generating && (
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Generating your plan... This may take a minute. Please don't close this page.
              </p>
            </div>
          )}

          {/* Generated Plan Review */}
          {generatedPlan && !generating && generatedPlan.phases && generatedPlan.week && (
            <div className="mt-8 bg-white rounded-xl p-6 border-2 border-green-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">✨ Your Generated Plan</h2>
              
              {/* Phases */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Training Phases</h3>
                <div className="space-y-2">
                  {generatedPlan.phases && Array.isArray(generatedPlan.phases) && generatedPlan.phases.map((phase: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-semibold text-gray-700 capitalize">{phase.name}</span>
                      <span className="text-gray-600">{phase.weekCount} weeks</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2">Total: {generatedPlan.totalWeeks} weeks</p>
              </div>

              {/* Week 1 */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Week 1</h3>
                <div className="space-y-3">
                  {generatedPlan.week && generatedPlan.week.days && Array.isArray(generatedPlan.week.days) && generatedPlan.week.days.map((day: any, idx: number) => {
                    const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                    const totalMiles = 
                      (day.warmup?.reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) || 0) +
                      (day.workout?.reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) || 0) +
                      (day.cooldown?.reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) || 0);
                    
                    return (
                      <div key={idx} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-gray-800">{dayNames[day.dayNumber]}</span>
                          <span className="text-sm text-gray-600">{totalMiles.toFixed(1)} miles</span>
                        </div>
                        {day.notes && (
                          <p className="text-sm text-gray-600 italic">{day.notes}</p>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          Warmup: {day.warmup?.length || 0} laps | 
                          Workout: {day.workout?.length || 0} laps | 
                          Cooldown: {day.cooldown?.length || 0} laps
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confirm Button */}
              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => {
                    setGeneratedPlan(null);
                    setError(null);
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-4 px-6 rounded-xl font-semibold hover:bg-gray-200 transition"
                >
                  Regenerate
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-4 px-6 rounded-xl font-bold hover:from-green-600 hover:to-emerald-600 transition disabled:opacity-50 shadow-lg"
                >
                  {saving ? 'Saving...' : 'Looks Good! Save Plan →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


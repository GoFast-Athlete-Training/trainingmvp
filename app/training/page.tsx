'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';
import { formatDate, isToday } from '@/lib/training/dates';
import { formatPace } from '@/lib/utils/pace';

// Format race date properly (handle timezone issues)
// Race dates are date-only values, so we use UTC to prevent timezone shifts
function formatRaceDate(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return `${month}/${day}/${year}`;
  } catch (error) {
    return 'Invalid date';
  }
}

interface TodayWorkout {
  id: string;
  date: Date;
  dayOfWeek: number;
  warmup: any[];
  workout: any[];
  cooldown: any[];
  notes: string | null;
  status: 'pending' | 'completed' | 'rest';
}

interface PlanStatus {
  hasPlan: boolean;
  totalWeeks: number;
  currentWeek: number;
  phase: string;
}

interface RaceReadiness {
  current5kPace: string | null;
  goalDelta: string | null;
  status: 'on-track' | 'behind' | 'impossible';
}

interface DraftPlan {
  id: string;
  name: string;
  goalTime: string | null;
  status: string;
  race: {
    id: string;
    name: string;
    distance: string;
    date: string;
  } | null;
  nextStep: string;
  nextStepUrl: string;
  progress: {
    hasRace: boolean;
    hasGoalTime: boolean;
    isComplete: boolean;
  };
}

export default function TrainingHub() {
  const router = useRouter();
  const [todayWorkout, setTodayWorkout] = useState<TodayWorkout | null>(null);
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [raceReadiness, setRaceReadiness] = useState<RaceReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPlan, setHasPlan] = useState(false);
  const [draftPlan, setDraftPlan] = useState<DraftPlan | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        console.log('❌ No Firebase user → redirecting to signup');
        router.push('/signup');
        return;
      }

      // Check if athlete is in localStorage
      let athlete = LocalStorageAPI.getAthlete();
      
      // If no athlete or hydration is stale, hydrate
      const hydrationTimestamp = LocalStorageAPI.getHydrationTimestamp();
      const isStale = !hydrationTimestamp || (Date.now() - hydrationTimestamp > 5 * 60 * 1000); // 5 minutes
      
      if (!athlete || isStale) {
        try {
          console.log('🔄 Hydrating athlete data...');
          const response = await api.post('/athlete/hydrate');
          if (response.data.success) {
            LocalStorageAPI.setAthlete(response.data.athlete);
            LocalStorageAPI.setHydrationTimestamp(Date.now());
            athlete = response.data.athlete;
          }
        } catch (err: any) {
          console.error('❌ Failed to hydrate:', err);
          if (err.response?.status === 401) {
            // Unauthorized - redirect to signup
            router.push('/signup');
            return;
          }
          if (err.response?.status === 404) {
            // Athlete doesn't exist - try to create it via /athlete/create
            console.log('ℹ️ Athlete not found (404), attempting to create...');
            try {
              const createResponse = await api.post('/athlete/create', {});
              if (createResponse.data.success) {
                // Athlete created, hydrate again
                const hydrateResponse = await api.post('/athlete/hydrate');
                if (hydrateResponse.data.success) {
                  LocalStorageAPI.setAthlete(hydrateResponse.data.athlete);
                  LocalStorageAPI.setHydrationTimestamp(Date.now());
                  athlete = hydrateResponse.data.athlete;
                  // Continue to load hub data
                  loadHubData();
                  return;
                }
              }
            } catch (createErr: any) {
              console.error('❌ Failed to create athlete:', createErr);
              // If create fails, redirect to signup (might need to sign up properly)
              router.push('/signup');
              return;
            }
          }
          // Other errors - still try to load hub data
        }
      }

      // Load hub data (will check for active plan)
      loadHubData();
    });

    return () => unsubscribe();
  }, [router]);

  async function loadHubData() {
    try {
      const response = await api.get('/training/hub');
      const data = response.data;
      
      setTodayWorkout(data.todayWorkout);
      setPlanStatus(data.planStatus);
      setRaceReadiness(data.raceReadiness);
      
      // Only set hasPlan to true if we actually have an active plan
      const hasActivePlan = data.planStatus?.hasPlan === true;
      setHasPlan(hasActivePlan);
      
      console.log('📊 TRAINING PAGE: Plan status:', {
        hasPlan: hasActivePlan,
        planStatus: data.planStatus,
      });

      // No need to check for draft - if no plan exists, show create button
    } catch (error: any) {
      console.error('❌ TRAINING PAGE: Error loading hub data:', error);
      if (error.response?.status === 401) {
        router.push('/signup');
        return;
      }
      // If error or no plan, show setup button
      setHasPlan(false);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl text-white">Loading your training...</p>
        </div>
      </div>
    );
  }

  // If no plan, show landing page with setup button or draft plan checklist
  if (!hasPlan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center p-4">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <div className="text-9xl mb-4">
              🏃‍♂️
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
              {draftPlan ? 'Continue Your Plan' : 'Ready to Train?'}
            </h1>
            <p className="text-xl md:text-2xl text-white/90 font-medium">
              {draftPlan 
                ? 'Complete your training plan setup to get started'
                : 'Create your personalized training plan and start crushing your goals'
              }
            </p>
          </div>

          {draftPlan ? (
            // Show checklist for draft plan
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Training Plan Setup</h2>
              <div className="space-y-4 text-left">
                {/* Step 1: Select Race */}
                <div className={`flex items-center gap-4 p-4 rounded-xl border-2 ${
                  draftPlan.progress.hasRace 
                    ? 'bg-green-50 border-green-300' 
                    : 'bg-orange-50 border-orange-300'
                }`}>
                  <div className={`text-3xl ${draftPlan.progress.hasRace ? 'text-green-600' : 'text-orange-600'}`}>
                    {draftPlan.progress.hasRace ? '✅' : '1️⃣'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg text-gray-900">Select Race</div>
                    {draftPlan.progress.hasRace && draftPlan.race && (
                      <div className="text-sm text-gray-600 mt-1">
                        {draftPlan.race.name} • {formatRaceDate(draftPlan.race.date)}
                      </div>
                    )}
                  </div>
                  {!draftPlan.progress.hasRace && (
                    <button
                      onClick={() => router.push(draftPlan.nextStepUrl)}
                      className="bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition"
                    >
                      {draftPlan.nextStep} →
                    </button>
                  )}
                </div>

                {/* Step 2: Set Goal Time */}
                <div className={`flex items-center gap-4 p-4 rounded-xl border-2 ${
                  draftPlan.progress.hasGoalTime 
                    ? 'bg-green-50 border-green-300' 
                    : draftPlan.progress.hasRace
                    ? 'bg-orange-50 border-orange-300'
                    : 'bg-gray-50 border-gray-200 opacity-50'
                }`}>
                  <div className={`text-3xl ${
                    draftPlan.progress.hasGoalTime 
                      ? 'text-green-600' 
                      : draftPlan.progress.hasRace
                      ? 'text-orange-600'
                      : 'text-gray-400'
                  }`}>
                    {draftPlan.progress.hasGoalTime ? '✅' : '2️⃣'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg text-gray-900">Set Goal Time</div>
                    {draftPlan.progress.hasGoalTime && draftPlan.goalTime && (
                      <div className="text-sm text-gray-600 mt-1">
                        Goal: {draftPlan.goalTime}
                      </div>
                    )}
                  </div>
                  {draftPlan.progress.hasRace && !draftPlan.progress.hasGoalTime && (
                    <button
                      onClick={() => router.push(draftPlan.nextStepUrl)}
                      className="bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition"
                    >
                      {draftPlan.nextStep} →
                    </button>
                  )}
                </div>

                {/* Step 3: Review & Generate */}
                <div className={`flex items-center gap-4 p-4 rounded-xl border-2 ${
                  draftPlan.progress.isComplete 
                    ? 'bg-orange-50 border-orange-300' 
                    : 'bg-gray-50 border-gray-200 opacity-50'
                }`}>
                  <div className={`text-3xl ${
                    draftPlan.progress.isComplete 
                      ? 'text-orange-600' 
                      : 'text-gray-400'
                  }`}>
                    3️⃣
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg text-gray-900">Review & Generate</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Generate your personalized training plan
                    </div>
                  </div>
                  {draftPlan.progress.isComplete && (
                    <button
                      onClick={() => router.push(draftPlan.nextStepUrl)}
                      className="bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition"
                    >
                      {draftPlan.nextStep} →
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Show create button if no draft plan
            <div className="space-y-6">
              <button
                onClick={async () => {
                  try {
                    console.log('🚀 Creating draft training plan...');
                    const response = await api.post('/training-plan/create', {});
                    if (response.data.success) {
                      const trainingPlanId = response.data.trainingPlanId;
                      console.log('✅ Draft plan created:', trainingPlanId);
                      router.push(`/training-setup/start?planId=${trainingPlanId}`);
                    } else {
                      console.error('❌ Failed to create plan:', response.data.error);
                      router.push('/training-setup/start');
                    }
                  } catch (err: any) {
                    console.error('❌ Error creating plan:', err);
                    router.push('/training-setup/start');
                  }
                }}
                className="w-full bg-white text-orange-600 py-6 px-8 rounded-2xl font-bold text-2xl hover:bg-orange-50 transition shadow-2xl transform hover:scale-105"
              >
                Set My Training Plan →
              </button>

              <div className="text-white/80 text-sm">
                <p>Pick your race • Set your goals • Build your plan</p>
              </div>
            </div>
          )}

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-4xl mb-2">🎯</div>
              <h3 className="font-semibold text-white mb-2">Personalized Plans</h3>
              <p className="text-white/80 text-sm">AI-generated training plans tailored to your fitness level</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-4xl mb-2">📊</div>
              <h3 className="font-semibold text-white mb-2">Track Progress</h3>
              <p className="text-white/80 text-sm">Monitor your workouts and see your improvement over time</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-4xl mb-2">🏆</div>
              <h3 className="font-semibold text-white mb-2">Race Ready</h3>
              <p className="text-white/80 text-sm">Get race-ready with adaptive training and pace guidance</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Has plan - show training hub
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
                        {todayWorkout.notes || 'Today\'s Workout'}
                      </h3>
                      <p className="text-gray-600">
                        {(() => {
                          const totalMiles = [
                            ...(todayWorkout.warmup || []),
                            ...(todayWorkout.workout || []),
                            ...(todayWorkout.cooldown || [])
                          ].reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0);
                          return totalMiles > 0 ? `${totalMiles.toFixed(1)} miles` : 'Workout';
                        })()}
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
                      <p className="text-sm text-gray-600">Total Distance</p>
                      <p className="text-2xl font-bold">
                        {(() => {
                          const totalMiles = [
                            ...(todayWorkout.warmup || []),
                            ...(todayWorkout.workout || []),
                            ...(todayWorkout.cooldown || [])
                          ].reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0);
                          return totalMiles > 0 ? `${totalMiles.toFixed(1)}` : 'N/A';
                        })()} mi
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Workout Laps</p>
                      <p className="text-2xl font-bold">
                        {todayWorkout.workout?.length || 0}
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
        {planStatus?.hasPlan && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">See My Plan</h2>
            <div>
              <p className="text-gray-600 mb-2">
                Week {planStatus.currentWeek} of {planStatus.totalWeeks} - {planStatus.phase} Phase
              </p>
              <button
                onClick={() => router.push('/training/plan')}
                className="text-orange-600 hover:text-orange-700 font-semibold"
              >
                View Full Plan →
              </button>
            </div>
            </div>
          )}

        {/* Race Readiness */}
        {raceReadiness && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Race Readiness Snapshot</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Current 5K Pace</p>
                <p className="text-2xl font-bold">
                  {raceReadiness.current5kPace || 'N/A'}
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
            onClick={() => {
              if (planStatus?.hasPlan && planStatus.currentWeek > 0) {
                router.push(`/training/plan/${planStatus.currentWeek}`);
              }
            }}
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


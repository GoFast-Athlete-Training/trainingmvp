'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';

export default function TrainingPlanPreviewPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const trainingPlanId = params.trainingPlanId as string;
  const startDateParam = searchParams.get('startDate');

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/signup');
        return;
      }

      // First, update plan with start date if provided (from review page)
      if (startDateParam) {
        try {
          const startDateObj = new Date(startDateParam);
          startDateObj.setUTCHours(0, 0, 0, 0);
          
          // Load plan to calculate weeks
          const planResponse = await api.get(`/training-plan/${trainingPlanId}`);
          if (planResponse.data.success) {
            const plan = planResponse.data.trainingPlan;
            const race = plan.race || plan.race_registry;
            
            let calculatedWeeks = plan.totalWeeks || 16;
            if (race?.date) {
              const raceDate = new Date(race.date);
              raceDate.setUTCHours(0, 0, 0, 0);
              const diffMs = raceDate.getTime() - startDateObj.getTime();
              const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
              calculatedWeeks = Math.max(8, Math.floor(diffDays / 7));
            }
            
            // Update plan with start date and weeks
            await api.post('/training-plan/update', {
              trainingPlanId,
              updates: {
                startDate: startDateObj.toISOString(),
                totalWeeks: calculatedWeeks,
              },
            });
            console.log('✅ PREVIEW: Plan updated with start date and weeks');
          }
        } catch (err: any) {
          console.error('❌ PREVIEW: Failed to update plan:', err);
          // Continue anyway - generation endpoint will validate
        }
      }

      // First try to load existing preview from Redis
      try {
        const response = await api.get(`/training-plan/preview/${trainingPlanId}`);
        if (response.data.success) {
          setPreview(response.data.preview);
          setLoading(false);
          return;
        }
      } catch (err: any) {
        // Preview doesn't exist yet, that's okay - we'll generate it
        console.log('📋 PREVIEW: No existing preview found, will generate');
      }

      // No preview found - generate it now
      setGenerating(true);
      try {
        console.log('🔄 PREVIEW: Generating plan...');
        const generateResponse = await api.post('/training-plan/generate', {
          trainingPlanId,
        });

        if (generateResponse.data.success) {
          // Wait a moment for Redis to store
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Now fetch the preview
          const previewResponse = await api.get(`/training-plan/preview/${trainingPlanId}`);
          if (previewResponse.data.success) {
            setPreview(previewResponse.data.preview);
          } else {
            setError(previewResponse.data.error || 'Failed to load generated preview');
          }
        } else {
          setError(generateResponse.data.error || generateResponse.data.details || 'Failed to generate plan');
        }
      } catch (err: any) {
        console.error('Generate/load preview error:', err);
        setError(err.response?.data?.error || err.response?.data?.details || 'Failed to generate preview');
      } finally {
        setGenerating(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, trainingPlanId, startDateParam]);

  const handleConfirm = async () => {
    if (!preview) {
      setError('No preview to confirm');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Confirm and save the plan
      const response = await api.put('/training-plan/generate', {
        trainingPlanId,
        plan: preview,
      });

      if (response.data.success) {
        router.push(`/training`);
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

  if (loading || generating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl text-white">
            {generating ? 'Generating your training plan...' : 'Loading preview...'}
          </p>
          {generating && (
            <p className="text-white/80 mt-2">This may take a minute. Please don't close this page.</p>
          )}
        </div>
      </div>
    );
  }

  if (error && !preview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl text-center max-w-md">
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => router.push(`/training-setup/${trainingPlanId}/review`)}
              className="bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-2xl">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
            Preview Your Training Plan ✨
          </h1>
          <p className="text-gray-600 mb-8">
            Review your generated training plan before confirming
          </p>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {preview && (
            <div className="space-y-6 mb-8 max-h-[70vh] overflow-y-auto pr-2">
              {/* Overview */}
              <div className="bg-gray-50 rounded-xl p-6 sticky top-0 z-10">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Training Plan Overview</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Weeks</p>
                    <p className="text-lg font-bold text-gray-800">{preview.totalWeeks || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phases</p>
                    <p className="text-lg font-bold text-gray-800">{preview.phases?.length || 0}</p>
                  </div>
                  {preview.generatedAt && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-600">Generated</p>
                      <p className="text-sm font-semibold text-gray-800">{new Date(preview.generatedAt).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Phases Overview */}
              {preview.phases && preview.phases.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Training Phases</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {preview.phases.map((phase: any, index: number) => (
                      <div key={index} className="bg-white rounded-lg p-4 border-2 border-gray-200">
                        <h4 className="font-semibold text-gray-800 capitalize mb-1">{phase.name || `Phase ${index + 1}`}</h4>
                        <p className="text-sm text-gray-600">{phase.weekCount || 0} weeks</p>
                        {phase.weeks && Array.isArray(phase.weeks) && (
                          <p className="text-xs text-gray-500 mt-1">Weeks {phase.weeks.join(', ')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Weeks - Scrollable */}
              {preview.weeks && Array.isArray(preview.weeks) && preview.weeks.length > 0 ? (
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-gray-800">All Training Weeks</h3>
                  {preview.weeks.map((week: any, weekIndex: number) => (
                    <div key={weekIndex} className="bg-white rounded-xl p-6 border-2 border-orange-200">
                      <h4 className="text-xl font-bold text-gray-800 mb-4">
                        Week {week.weekNumber || weekIndex + 1}
                        {week.phase && <span className="text-sm font-normal text-gray-600 ml-2">({week.phase})</span>}
                      </h4>
                      
                      {week.days && Array.isArray(week.days) && week.days.length > 0 ? (
                        <div className="space-y-3">
                          {week.days.map((day: any, dayIndex: number) => {
                            const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                            const totalMiles = 
                              (day.warmup?.reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) || 0) +
                              (day.workout?.reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) || 0) +
                              (day.cooldown?.reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) || 0);
                            
                            return (
                              <div key={dayIndex} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-semibold text-gray-800">{dayNames[day.dayNumber] || `Day ${day.dayNumber}`}</span>
                                  <span className="text-sm font-bold text-orange-600">{totalMiles.toFixed(1)} miles</span>
                                </div>
                                {day.notes && (
                                  <p className="text-sm text-gray-700 italic mb-2">{day.notes}</p>
                                )}
                                <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                                  <div>
                                    <span className="font-semibold">Warmup:</span> {day.warmup?.length || 0} laps
                                  </div>
                                  <div>
                                    <span className="font-semibold">Workout:</span> {day.workout?.length || 0} laps
                                  </div>
                                  <div>
                                    <span className="font-semibold">Cooldown:</span> {day.cooldown?.length || 0} laps
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No days scheduled for this week</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : preview.week ? (
                // Fallback: Show single week if weeks array doesn't exist
                <div className="bg-white rounded-xl p-6 border-2 border-orange-200">
                  <h4 className="text-xl font-bold text-gray-800 mb-4">
                    Week {preview.week.weekNumber || 1}
                  </h4>
                  
                  {preview.week.days && Array.isArray(preview.week.days) && preview.week.days.length > 0 ? (
                    <div className="space-y-3">
                      {preview.week.days.map((day: any, dayIndex: number) => {
                        const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                        const totalMiles = 
                          (day.warmup?.reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) || 0) +
                          (day.workout?.reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) || 0) +
                          (day.cooldown?.reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0) || 0);
                        
                        return (
                          <div key={dayIndex} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-gray-800">{dayNames[day.dayNumber] || `Day ${day.dayNumber}`}</span>
                              <span className="text-sm font-bold text-orange-600">{totalMiles.toFixed(1)} miles</span>
                            </div>
                            {day.notes && (
                              <p className="text-sm text-gray-700 italic mb-2">{day.notes}</p>
                            )}
                            <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                              <div>
                                <span className="font-semibold">Warmup:</span> {day.warmup?.length || 0} laps
                              </div>
                              <div>
                                <span className="font-semibold">Workout:</span> {day.workout?.length || 0} laps
                              </div>
                              <div>
                                <span className="font-semibold">Cooldown:</span> {day.cooldown?.length || 0} laps
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No days scheduled</p>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800">No week data available in preview</p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => router.push(`/training-setup/${trainingPlanId}/review`)}
              className="flex-1 bg-gray-100 text-gray-700 py-4 px-6 rounded-xl font-semibold hover:bg-gray-200 transition"
            >
              ← Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || !preview}
              className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 px-6 rounded-xl font-bold hover:from-orange-600 hover:to-red-600 transition disabled:opacity-50 shadow-lg"
            >
              {saving ? 'Saving...' : 'Confirm & Save Plan →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

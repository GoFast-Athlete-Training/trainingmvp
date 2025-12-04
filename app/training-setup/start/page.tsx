'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';

export default function TrainingSetupStartPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [trainingPlanId, setTrainingPlanId] = useState<string | null>(null);

  // Get trainingPlanId from URL params and auto-search for races
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const planId = urlParams.get('planId');
    if (planId) {
      setTrainingPlanId(planId);
      console.log('📋 Training plan ID from URL:', planId);
      
      // Auto-search for common races to help user find existing races
      const commonQueries = ['Boston', 'Marathon', '5k', '10k', 'Half'];
      // Try searching for "Boston" first (most common)
      setSearchQuery('Boston');
      handleSearchForQuery('Boston');
    }
  }, []);

  const handleSearchForQuery = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await api.post('/race/search', { query });
      if (response.data.success) {
        const races = response.data.races || [];
        setSearchResults(races);
      } else {
        setError(response.data.error || 'Failed to search races');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      const errorStatus = err.response?.status;
      const errorData = err.response?.data;
      
      if (errorStatus === 503) {
        setError('Race search is temporarily unavailable. Please create a new race instead.');
      } else {
        setError(errorData?.error || errorData?.details || 'Failed to search races. You can still create a new race below.');
      }
    } finally {
      setSearching(false);
    }
  };

  // Create race form state
  const [raceName, setRaceName] = useState('');
  const [raceDistance, setRaceDistance] = useState('5k');
  const [raceDate, setRaceDate] = useState('');
  const [raceCity, setRaceCity] = useState('');
  const [raceState, setRaceState] = useState('');
  const [raceCountry, setRaceCountry] = useState('USA');

  const handleSearch = async () => {
    await handleSearchForQuery(searchQuery);
  };

  const handleSelectRace = async (race: any) => {
    setLoading(true);
    setError(null);

    try {
      // Get trainingPlanId from URL params or state
      const planId = trainingPlanId || new URLSearchParams(window.location.search).get('planId');
      
      if (planId) {
        // Update existing draft plan with race
        console.log('📋 Updating training plan with race:', race.id);
        
        // Calculate total weeks from race date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const raceDate = new Date(race.date);
        raceDate.setHours(0, 0, 0, 0);
        const daysUntilRace = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const totalWeeks = Math.max(8, Math.floor(daysUntilRace / 7));

        const response = await api.post('/training-plan/update', {
          trainingPlanId: planId,
          updates: {
            raceRegistryId: race.id,
            trainingPlanName: `${race.name} Training Plan`,
            trainingPlanTotalWeeks: totalWeeks,
          },
        });

        if (response.data.success) {
          console.log('✅ Training plan updated with race:', planId);
          router.push(`/training-setup/${planId}`);
        } else {
          const errorMsg = response.data.error || response.data.details || 'Failed to update training plan';
          console.error('❌ Training plan update failed:', errorMsg);
          setError(`Failed to update training plan: ${errorMsg}`);
        }
      } else {
        // Create new plan with race (fallback for direct navigation)
        console.log('📋 Creating training plan for race:', race.id);
        const response = await api.post('/training-plan/create', {
          raceRegistryId: race.id,
        });

        if (response.data.success) {
          console.log('✅ Training plan created:', response.data.trainingPlanId);
          router.push(`/training-setup/${response.data.trainingPlanId}`);
        } else {
          const errorMsg = response.data.error || response.data.details || 'Failed to create training plan';
          console.error('❌ Training plan creation failed:', errorMsg);
          setError(`Failed to create training plan: ${errorMsg}`);
        }
      }
    } catch (err: any) {
      console.error('❌ Error:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to process';
      setError(`Failed: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRace = async () => {
    if (!raceName || !raceDate) {
      setError('Race name and date are required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      // Step 1: Create or find race (separate concern)
      console.log('🏁 STEP 1: Creating/finding race...');
      const createRaceResponse = await api.post('/race/create', {
        name: raceName,
        distance: raceDistance,
        date: raceDate,
        city: raceCity || null,
        state: raceState || null,
        country: raceCountry || null,
      });

      if (!createRaceResponse.data.success) {
        setError(createRaceResponse.data.error || 'Failed to create race');
        return;
      }

      const raceId = createRaceResponse.data.race.id;
      console.log('✅ STEP 1: Race created/found:', raceId);

      // Step 2: Update existing plan or create new one
      const planId = trainingPlanId || new URLSearchParams(window.location.search).get('planId');
      
      if (planId) {
        // Update existing draft plan with race
        console.log('📋 STEP 2: Updating training plan with race...');
        try {
          // Calculate total weeks from race date
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const raceDateObj = new Date(raceDate);
          raceDateObj.setHours(0, 0, 0, 0);
          const daysUntilRace = Math.ceil((raceDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const totalWeeks = Math.max(8, Math.floor(daysUntilRace / 7));

          const updatePlanResponse = await api.post('/training-plan/update', {
            trainingPlanId: planId,
            updates: {
              raceRegistryId: raceId,
              trainingPlanName: `${raceName} Training Plan`,
              trainingPlanTotalWeeks: totalWeeks,
            },
          });

          if (updatePlanResponse.data.success) {
            console.log('✅ STEP 2: Training plan updated:', planId);
            router.push(`/training-setup/${planId}`);
          } else {
            setError(`Race saved successfully, but failed to update training plan: ${updatePlanResponse.data.error || 'Unknown error'}`);
          }
        } catch (planErr: any) {
          console.error('❌ STEP 2: Training plan update failed:', planErr);
          const planErrorMsg = planErr.response?.data?.error || planErr.response?.data?.details || planErr.message || 'Unknown error';
          setError(`Race saved successfully, but failed to update training plan: ${planErrorMsg}`);
        }
      } else {
        // Create new plan with race
        console.log('📋 STEP 2: Creating training plan...');
        try {
          const createPlanResponse = await api.post('/training-plan/create', {
            raceRegistryId: raceId,
          });

          if (createPlanResponse.data.success) {
            console.log('✅ STEP 2: Training plan created:', createPlanResponse.data.trainingPlanId);
            router.push(`/training-setup/${createPlanResponse.data.trainingPlanId}`);
          } else {
            setError(`Race saved successfully, but failed to create training plan: ${createPlanResponse.data.error || 'Unknown error'}`);
          }
        } catch (planErr: any) {
          console.error('❌ STEP 2: Training plan creation failed:', planErr);
          const planErrorMsg = planErr.response?.data?.error || planErr.response?.data?.details || planErr.message || 'Unknown error';
          setError(`Race saved successfully, but failed to create training plan: ${planErrorMsg}`);
        }
      }
    } catch (err: any) {
      // Race creation failed
      console.error('❌ STEP 1: Race creation failed:', err);
      const raceErrorMsg = err.response?.data?.error || err.response?.data?.details || err.message || 'Unknown error';
      setError(`Failed to create race: ${raceErrorMsg}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-2xl">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
            Pick Your Race 🏃‍♂️
          </h1>
          <p className="text-gray-600 mb-8">
            Search for an existing race or create a new one
          </p>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {/* Search Section */}
          <div className="mb-8">
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search for a race (e.g., Boston Marathon)"
                className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition disabled:opacity-50"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((race) => (
                  <button
                    key={race.id}
                    onClick={() => handleSelectRace(race)}
                    disabled={loading}
                    className="w-full text-left p-4 bg-gray-50 hover:bg-orange-50 rounded-xl border-2 border-transparent hover:border-orange-200 transition"
                  >
                    <div className="font-semibold text-lg">{race.name}</div>
                    <div className="text-sm text-gray-600">
                      {race.distance.toUpperCase()} • {new Date(race.date).toLocaleDateString()}
                      {race.city && ` • ${race.city}, ${race.state || race.country}`}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {hasSearched && !searching && searchResults.length === 0 && !error && (
              <div className="bg-blue-50 border-2 border-blue-200 text-blue-700 px-4 py-3 rounded-xl mb-4">
                <p className="font-semibold">No races found</p>
                <p className="text-sm mt-1">Please create a new race below to get started.</p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px bg-gray-300"></div>
            <span className="text-gray-500 font-semibold">OR</span>
            <div className="flex-1 h-px bg-gray-300"></div>
          </div>

          {/* Create Race Section */}
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full bg-white border-2 border-orange-500 text-orange-600 py-4 px-6 rounded-xl font-semibold text-lg hover:bg-orange-50 transition"
            >
              + Create New Race
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Race Name *
                </label>
                <input
                  type="text"
                  value={raceName}
                  onChange={(e) => setRaceName(e.target.value)}
                  placeholder="e.g., My Local 5K"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Distance *
                </label>
                <select
                  value={raceDistance}
                  onChange={(e) => setRaceDistance(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg"
                >
                  <option value="5k">5K</option>
                  <option value="10k">10K</option>
                  <option value="10m">10 Mile</option>
                  <option value="half">Half Marathon</option>
                  <option value="marathon">Marathon</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Race Date *
                </label>
                <input
                  type="date"
                  value={raceDate}
                  onChange={(e) => setRaceDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={raceCity}
                    onChange={(e) => setRaceCity(e.target.value)}
                    placeholder="City"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    State
                  </label>
                  <select
                    value={raceState}
                    onChange={(e) => setRaceState(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">Select State</option>
                    <option value="AL">Alabama</option>
                    <option value="AK">Alaska</option>
                    <option value="AZ">Arizona</option>
                    <option value="AR">Arkansas</option>
                    <option value="CA">California</option>
                    <option value="CO">Colorado</option>
                    <option value="CT">Connecticut</option>
                    <option value="DE">Delaware</option>
                    <option value="FL">Florida</option>
                    <option value="GA">Georgia</option>
                    <option value="HI">Hawaii</option>
                    <option value="ID">Idaho</option>
                    <option value="IL">Illinois</option>
                    <option value="IN">Indiana</option>
                    <option value="IA">Iowa</option>
                    <option value="KS">Kansas</option>
                    <option value="KY">Kentucky</option>
                    <option value="LA">Louisiana</option>
                    <option value="ME">Maine</option>
                    <option value="MD">Maryland</option>
                    <option value="MA">Massachusetts</option>
                    <option value="MI">Michigan</option>
                    <option value="MN">Minnesota</option>
                    <option value="MS">Mississippi</option>
                    <option value="MO">Missouri</option>
                    <option value="MT">Montana</option>
                    <option value="NE">Nebraska</option>
                    <option value="NV">Nevada</option>
                    <option value="NH">New Hampshire</option>
                    <option value="NJ">New Jersey</option>
                    <option value="NM">New Mexico</option>
                    <option value="NY">New York</option>
                    <option value="NC">North Carolina</option>
                    <option value="ND">North Dakota</option>
                    <option value="OH">Ohio</option>
                    <option value="OK">Oklahoma</option>
                    <option value="OR">Oregon</option>
                    <option value="PA">Pennsylvania</option>
                    <option value="RI">Rhode Island</option>
                    <option value="SC">South Carolina</option>
                    <option value="SD">South Dakota</option>
                    <option value="TN">Tennessee</option>
                    <option value="TX">Texas</option>
                    <option value="UT">Utah</option>
                    <option value="VT">Vermont</option>
                    <option value="VA">Virginia</option>
                    <option value="WA">Washington</option>
                    <option value="WV">West Virginia</option>
                    <option value="WI">Wisconsin</option>
                    <option value="WY">Wyoming</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setRaceName('');
                    setRaceDate('');
                    setRaceCity('');
                    setRaceState('');
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRace}
                  disabled={creating || !raceName || !raceDate}
                  className="flex-1 bg-orange-500 text-white py-3 px-6 rounded-xl font-semibold hover:bg-orange-600 transition disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create & Continue'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


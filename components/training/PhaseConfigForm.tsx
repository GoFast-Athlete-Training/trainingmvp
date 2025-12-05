'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_RUN_TYPES_BY_PHASE } from '@/lib/training/runTypes';

interface RunTypesEnabled {
  easy: boolean;
  tempo: boolean;
  intervals: boolean;
  longRun: boolean;
}

interface PhaseConfigFormProps {
  phaseId: string;
  phaseName: string;
  initialData?: {
    phaseDescription?: string | null;
    phaseTotalMilesTarget?: number | null;
    longRunProgression?: number[];
    qualityWorkoutsPerWeek?: number;
    runTypesEnabled?: RunTypesEnabled | null;
  };
  onSave: (data: {
    phaseDescription: string;
    phaseTotalMilesTarget: number | null;
    longRunProgression: number[];
    qualityWorkoutsPerWeek: number;
    runTypesEnabled: RunTypesEnabled;
  }) => Promise<void>;
}

export default function PhaseConfigForm({
  phaseId,
  phaseName,
  initialData,
  onSave,
}: PhaseConfigFormProps) {
  const [phaseDescription, setPhaseDescription] = useState(
    initialData?.phaseDescription || ''
  );
  const [phaseTotalMilesTarget, setPhaseTotalMilesTarget] = useState<string>(
    initialData?.phaseTotalMilesTarget?.toString() || ''
  );
  const [longRunProgressionInput, setLongRunProgressionInput] = useState<string>(
    initialData?.longRunProgression?.join(', ') || ''
  );
  const [qualityWorkoutsPerWeek, setQualityWorkoutsPerWeek] = useState<number>(
    initialData?.qualityWorkoutsPerWeek || 1
  );
  const [runTypesEnabled, setRunTypesEnabled] = useState<RunTypesEnabled>(
    initialData?.runTypesEnabled || DEFAULT_RUN_TYPES_BY_PHASE[phaseName] || {
      easy: true,
      tempo: false,
      intervals: false,
      longRun: true,
    }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      // Parse long run progression
      const longRunProgression = longRunProgressionInput
        .split(',')
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n) && n > 0);

      // Parse total miles target
      const totalMilesTarget =
        phaseTotalMilesTarget.trim() === ''
          ? null
          : parseFloat(phaseTotalMilesTarget);

      if (totalMilesTarget !== null && (isNaN(totalMilesTarget) || totalMilesTarget < 0)) {
        setError('Total miles target must be a positive number');
        setSaving(false);
        return;
      }

      await onSave({
        phaseDescription: phaseDescription.trim(),
        phaseTotalMilesTarget: totalMilesTarget,
        longRunProgression,
        qualityWorkoutsPerWeek,
        runTypesEnabled,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save phase config');
    } finally {
      setSaving(false);
    }
  };

  const toggleRunType = (type: keyof RunTypesEnabled) => {
    setRunTypesEnabled((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Configure {phaseName.charAt(0).toUpperCase() + phaseName.slice(1)} Phase
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Phase Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Phase Description
          </label>
          <textarea
            value={phaseDescription}
            onChange={(e) => setPhaseDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="In this phase we focus on rebuilding your aerobic base and gradually increasing volume."
          />
        </div>

        {/* Total Miles Target */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Target Total Miles (Optional)
          </label>
          <input
            type="number"
            value={phaseTotalMilesTarget}
            onChange={(e) => setPhaseTotalMilesTarget(e.target.value)}
            min="0"
            step="0.1"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 200"
          />
        </div>

        {/* Long Run Progression */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Long Run Progression (miles, comma-separated)
          </label>
          <input
            type="text"
            value={longRunProgressionInput}
            onChange={(e) => setLongRunProgressionInput(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 10, 12, 14, 12"
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter distances in miles, separated by commas (e.g., 10, 12, 14, 12)
          </p>
        </div>

        {/* Quality Workouts Per Week */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Quality Workouts Per Week
          </label>
          <select
            value={qualityWorkoutsPerWeek}
            onChange={(e) => setQualityWorkoutsPerWeek(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </div>

        {/* Run Types Enabled */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 mb-3">
            Enabled Run Types
          </label>
          <div className="space-y-2">
            {(['easy', 'tempo', 'intervals', 'longRun'] as const).map((type) => (
              <label key={type} className="flex items-center">
                <input
                  type="checkbox"
                  checked={runTypesEnabled[type]}
                  onChange={() => toggleRunType(type)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 capitalize">
                  {type === 'longRun' ? 'Long Run' : type}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Phase Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}


'use client';

import { formatProgression } from '@/lib/training/longRunProgression';

interface PhaseOverviewCardProps {
  phaseName: string;
  phaseDescription: string | null;
  phaseTotalMilesTarget: number | null;
  phaseTotalMilesActual: number | null;
  longRunProgression: number[];
  weekCount: number;
  currentWeek: number; // Week number within the phase (1-based)
}

export default function PhaseOverviewCard({
  phaseName,
  phaseDescription,
  phaseTotalMilesTarget,
  phaseTotalMilesActual,
  longRunProgression,
  weekCount,
  currentWeek,
}: PhaseOverviewCardProps) {
  const phaseNameCapitalized = phaseName.charAt(0).toUpperCase() + phaseName.slice(1);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      {/* Phase Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">{phaseNameCapitalized} Phase</h2>
        <p className="text-sm text-gray-500 mt-1">
          Week {currentWeek} of {weekCount}
        </p>
      </div>

      {/* Phase Description */}
      {phaseDescription && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700">{phaseDescription}</p>
        </div>
      )}

      {/* Total Miles */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Target Miles</p>
          <p className="text-lg font-semibold text-gray-900">
            {phaseTotalMilesTarget ? `${phaseTotalMilesTarget.toFixed(0)} mi` : 'Not set'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Actual Miles</p>
          <p className="text-lg font-semibold text-gray-700">
            {phaseTotalMilesActual ? `${phaseTotalMilesActual.toFixed(0)} mi` : '—'}
          </p>
        </div>
      </div>

      {/* Long Run Progression */}
      {longRunProgression && longRunProgression.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">Long Run Progression</p>
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm font-medium text-purple-900">
              {formatProgression(longRunProgression)}
            </p>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Phase Progress</span>
          <span>{Math.round((currentWeek / weekCount) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${(currentWeek / weekCount) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}


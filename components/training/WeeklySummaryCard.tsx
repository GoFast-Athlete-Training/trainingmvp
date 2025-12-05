'use client';

import { RUN_TYPES, getRunTypeConfig, RunType } from '@/lib/training/runTypes';

interface DaySummary {
  dayName: string;
  runType: RunType | 'rest';
  distance: number; // miles
}

interface WeeklySummaryCardProps {
  weekNumber: number;
  weekDates: { start: Date; end: Date };
  days: DaySummary[];
  totalDistance: number;
}

export default function WeeklySummaryCard({
  weekNumber,
  weekDates,
  days,
  totalDistance,
}: WeeklySummaryCardProps) {
  const formatDate = (date: Date): string => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  };

  const formatWeekRange = (): string => {
    return `${formatDate(weekDates.start)} - ${formatDate(weekDates.end)}`;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      {/* Week Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Week {weekNumber}</h3>
          <span className="text-sm text-gray-500">{formatWeekRange()}</span>
        </div>
        <div className="mt-1 text-sm text-gray-600">
          {days.length} workouts · {totalDistance.toFixed(1)} mi
        </div>
      </div>

      {/* Day List */}
      <div className="space-y-2">
        {days.map((day, idx) => {
          if (day.runType === 'rest') {
            return (
              <div key={idx} className="flex items-center text-sm text-gray-400">
                <span className="w-12">{day.dayName}</span>
                <span>Rest</span>
              </div>
            );
          }

          const runConfig = getRunTypeConfig(day.runType);
          return (
            <div
              key={idx}
              className="flex items-center text-sm"
              style={{ color: runConfig.color }}
            >
              <span className="w-12 font-medium">{day.dayName}</span>
              <span
                className="px-2 py-0.5 rounded text-xs font-medium mr-2"
                style={{
                  backgroundColor: runConfig.bgColor,
                  color: runConfig.color,
                  border: `1px solid ${runConfig.borderColor}`,
                }}
              >
                {runConfig.label}
              </span>
              <span className="text-gray-700">{day.distance.toFixed(1)} mi</span>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-700">Total</span>
          <span className="text-sm font-bold text-gray-900">{totalDistance.toFixed(1)} mi</span>
        </div>
      </div>
    </div>
  );
}


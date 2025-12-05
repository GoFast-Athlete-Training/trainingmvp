/**
 * Run Type Constants and Utilities
 * Simplified to 4 run types for MVP1/2: Easy, Tempo, Intervals, Long Run
 */

export type RunType = 'easy' | 'tempo' | 'intervals' | 'longRun';

export interface RunTypeConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const RUN_TYPES: Record<RunType, RunTypeConfig> = {
  easy: {
    label: 'Easy Run',
    color: '#16a34a', // green-600
    bgColor: '#dcfce7', // green-100
    borderColor: '#86efac', // green-300
  },
  tempo: {
    label: 'Tempo',
    color: '#ea580c', // orange-600
    bgColor: '#ffedd5', // orange-100
    borderColor: '#fdba74', // orange-300
  },
  intervals: {
    label: 'Intervals',
    color: '#ca8a04', // yellow-600
    bgColor: '#fef9c3', // yellow-100
    borderColor: '#fde047', // yellow-300
  },
  longRun: {
    label: 'Long Run',
    color: '#9333ea', // purple-600
    bgColor: '#f3e8ff', // purple-100
    borderColor: '#c084fc', // purple-300
  },
};

/**
 * Get run type config by type string
 */
export function getRunTypeConfig(type: string): RunTypeConfig {
  const normalized = type.toLowerCase().replace(/\s+/g, '');
  if (normalized === 'longrun' || normalized === 'long_run') {
    return RUN_TYPES.longRun;
  }
  return RUN_TYPES[normalized as RunType] || RUN_TYPES.easy;
}

/**
 * Default run types enabled for each phase
 */
export const DEFAULT_RUN_TYPES_BY_PHASE: Record<string, { easy: boolean; tempo: boolean; intervals: boolean; longRun: boolean }> = {
  base: {
    easy: true,
    tempo: false,
    intervals: false,
    longRun: true,
  },
  build: {
    easy: true,
    tempo: true,
    intervals: true,
    longRun: true,
  },
  peak: {
    easy: true,
    tempo: true,
    intervals: true,
    longRun: true,
  },
  taper: {
    easy: true,
    tempo: true,
    intervals: false,
    longRun: true,
  },
};


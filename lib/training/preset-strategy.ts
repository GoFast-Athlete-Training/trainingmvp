/** Shared preset strategy types (mirrors gofastapp-mvp/lib/training/preset-strategy.ts). */

/** Catalogue segment paceKey labels — offsets live on catalogue rows, not preset JSON. */
export const CANONICAL_PACE_KEYS = [
  "relaxed",
  "easy",
  "steady",
  "moderate",
  "threshold",
  "fiveKPace",
  "tenKPace",
  "marathonPace",
  "recoveryJog",
] as const;

export type CanonicalPaceKey = (typeof CANONICAL_PACE_KEYS)[number];

export type WeeklyWorkoutComposition = {
  easy: number;
  tempo: number;
  intervals: number;
  longRun: number;
  cadenceWeeks: number;
};

export type CoachPlanOverview = {
  summary: string;
  weeklyVolume: { min: number; max: number | null };
  weeklyWorkoutComposition: WeeklyWorkoutComposition;
  longRunStructure?: {
    peakLongRunMiles?: number;
    cyclePoolAlignment?: string;
  };
  intervalStructure?: { intent: string; structureFamily: string };
  tempoStructure?: { intent: string; structureFamily: string };
  easyStructure?: { intent: string; structureFamily: string };
};

export type AthletePersonaCapability =
  | "NON_RUNNER"
  | "BEGINNER"
  | "RECREATIONAL"
  | "COMPETITIVE"
  | "ELITE";

export type AthletePersonaDedication = "LOW" | "MODERATE" | "HIGH" | "ELITE";

export const PERSONA_CAPABILITY_OPTIONS: { value: AthletePersonaCapability; label: string }[] = [
  { value: "NON_RUNNER", label: "Non-runner" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "RECREATIONAL", label: "Recreational" },
  { value: "COMPETITIVE", label: "Competitive" },
  { value: "ELITE", label: "Elite" },
];

export const PERSONA_DEDICATION_OPTIONS: { value: AthletePersonaDedication; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MODERATE", label: "Moderate" },
  { value: "HIGH", label: "High" },
  { value: "ELITE", label: "Elite" },
];

export type ProgressionAggressiveness = "CONSERVATIVE" | "MODERATE" | "AMBITIOUS";

export function startingLevelToPersonaCapability(
  level: string
): AthletePersonaCapability {
  switch (level) {
    case "nonRunner":
      return "NON_RUNNER";
    case "beginner":
      return "BEGINNER";
    case "competitive":
      return "COMPETITIVE";
    case "elite":
      return "ELITE";
    default:
      return "RECREATIONAL";
  }
}

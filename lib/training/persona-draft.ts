import { buildPersonaSlug, type AthletePersonaCapability } from "@/lib/training/plan-entity-slugs";
import {
  coercePersonaTrainingProfile,
  type PersonaTrainingProfile,
  type PersonaTrainingProfileKey,
} from "@/lib/training/persona-training-profile";

const CAPABILITIES = new Set<AthletePersonaCapability>([
  "NON_RUNNER",
  "BEGINNER",
  "RECREATIONAL",
  "COMPETITIVE",
  "ELITE",
]);

const DEDICATIONS = ["LOW", "MODERATE", "HIGH", "ELITE"] as const;

export type PersonaDedication = (typeof DEDICATIONS)[number];

export type PersonaDraft = {
  title: string;
  capability: AthletePersonaCapability;
  dedication: PersonaDedication | null;
  personaGoalLabel: string | null;
  intentSummary: string;
  athletePersonaSummary: string;
  targetDistanceLabel: string | null;
  goalKind: "RACE" | "TRAINING_BLOCK";
  slug: string;
  workoutFrequencyCap: number | null;
  trainingProfile: PersonaTrainingProfile | null;
};

function strOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function numbersInText(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? [];
}

export function numericClaimsAreGrounded(value: string, description: string): boolean {
  const allowed = new Set(numbersInText(description));
  return numbersInText(value).every((n) => allowed.has(n));
}

export function explicitDedicationFromDescription(description: string): PersonaDedication | null {
  const text = description.toLowerCase();
  const labeled = text.match(/\b(low|moderate|high|elite)\s+(dedication|commitment)\b/);
  const reversed = text.match(
    /\b(dedication|commitment)\s+(?:is\s+|level\s+(?:is\s+)?)?(low|moderate|high|elite)\b/,
  );
  const word = labeled?.[1] ?? reversed?.[2];
  if (!word) return null;
  const level = word.toUpperCase() as PersonaDedication;
  return DEDICATIONS.includes(level) ? level : null;
}

export function explicitWorkoutFrequencyCap(description: string): number | null {
  const match = description.match(/\b(\d{1,2})\s*(?:days?|sessions?|times)\s*(?:a|per|\/)\s*week\b/i);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n < 1 || n > 14) return null;
  return n;
}

function groundProfile(
  profile: PersonaTrainingProfile | null,
  description: string,
): PersonaTrainingProfile | null {
  if (!profile) return null;
  const next: PersonaTrainingProfile = { ...profile };
  const groundedKeys: PersonaTrainingProfileKey[] = ["weeklyMileage", "trainingFrequency"];
  for (const key of groundedKeys) {
    const fact = next[key];
    if (fact && !numericClaimsAreGrounded(fact.value, description)) {
      delete next[key];
    }
  }
  return Object.keys(next).length ? next : null;
}

function summaryCarriesProfile(summary: string, profile: PersonaTrainingProfile): boolean {
  const mileageNums = numbersInText(profile.weeklyMileage?.value ?? "");
  if (mileageNums.some((n) => !summary.includes(n))) return false;
  const intensity = profile.intensityTolerance?.value.toLowerCase() ?? "";
  if (intensity && !summary.toLowerCase().includes(intensity)) return false;
  const volume = profile.volumeTolerance?.value.toLowerCase() ?? "";
  if (volume && !summary.toLowerCase().includes(volume)) return false;
  const sustainable =
    /sustain/i.test(profile.coachingPhilosophy?.value ?? "") ||
    /sustain/i.test(profile.trainingPriorities?.value ?? "");
  if (sustainable && !/sustain/i.test(summary)) return false;
  return true;
}

function composeAthleteSummary(profile: PersonaTrainingProfile): string {
  const experience = profile.experience?.value;
  const mileage = profile.weeklyMileage?.value;
  const intensity = profile.intensityTolerance?.value;
  const volume = profile.volumeTolerance?.value;
  const goal = profile.primaryGoal?.value;
  let sentence = experience ? `${experience} athlete` : "This athlete";
  if (mileage) sentence += ` running ${mileage}`;
  const traits: string[] = [];
  if (intensity) traits.push(`${intensity.toLowerCase()} intensity tolerance`);
  if (volume) traits.push(`${volume.toLowerCase()} volume tolerance`);
  if (traits.length) sentence += ` with ${traits.join(" and ")}`;
  sentence += ".";
  const parts = [sentence];
  if (goal) parts.push(`Goal: ${goal}.`);
  const sustainable =
    /sustain/i.test(profile.coachingPhilosophy?.value ?? "") ||
    /sustain/i.test(profile.trainingPriorities?.value ?? "");
  if (sustainable) parts.push("Training should stay sustainable.");
  return parts.join(" ");
}

export function validatePersonaDraft(
  raw: Record<string, unknown>,
  description: string,
): PersonaDraft {
  const capabilityRaw = strOrNull(raw.capability)?.toUpperCase() as AthletePersonaCapability | null;
  let capability =
    capabilityRaw && CAPABILITIES.has(capabilityRaw) ? capabilityRaw : "RECREATIONAL";
  if (capability === "ELITE" && !/\b(elite|professional)\b/i.test(description)) {
    capability = "COMPETITIVE";
  }

  const dedication = explicitDedicationFromDescription(description);
  const workoutFrequencyCap = explicitWorkoutFrequencyCap(description);

  const goalKindRaw = strOrNull(raw.goalKind)?.toLowerCase();
  const goalKind: PersonaDraft["goalKind"] =
    goalKindRaw === "trainingblock" || goalKindRaw === "training_block" ? "TRAINING_BLOCK" : "RACE";

  const trainingProfile = groundProfile(coercePersonaTrainingProfile(raw.trainingProfile), description);
  const targetDistanceLabel =
    trainingProfile?.targetDistance?.value ?? strOrNull(raw.targetDistanceLabel);
  const personaGoalLabel = (
    trainingProfile?.primaryGoal?.value ?? strOrNull(raw.personaGoalLabel)
  )?.slice(0, 180) ?? null;
  const intentSummary =
    trainingProfile?.trainingPriorities?.value ??
    strOrNull(raw.intentSummary) ??
    description.trim();
  const modelSummary = strOrNull(raw.athletePersonaSummary) ?? intentSummary;
  const athletePersonaSummary =
    trainingProfile && !summaryCarriesProfile(modelSummary, trainingProfile)
      ? composeAthleteSummary(trainingProfile)
      : modelSummary;
  const title =
    strOrNull(raw.title) ??
    [trainingProfile?.experience?.value, targetDistanceLabel, personaGoalLabel]
      .filter(Boolean)
      .join(" · ");

  return {
    title,
    capability,
    dedication,
    personaGoalLabel,
    intentSummary,
    athletePersonaSummary,
    targetDistanceLabel,
    goalKind,
    slug: buildPersonaSlug({ capability, targetDistanceLabel, goalKind, title }),
    workoutFrequencyCap,
    trainingProfile,
  };
}

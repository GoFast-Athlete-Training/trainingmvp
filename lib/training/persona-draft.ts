import { buildPersonaSlug, type AthletePersonaCapability } from "@/lib/training/plan-entity-slugs";

const CAPABILITIES = new Set<AthletePersonaCapability>([
  "NON_RUNNER",
  "BEGINNER",
  "RECREATIONAL",
  "COMPETITIVE",
  "ELITE",
]);

const DEDICATIONS = new Set(["LOW", "MODERATE", "HIGH", "ELITE"]);

export type PersonaDraft = {
  title: string;
  capability: AthletePersonaCapability;
  dedication: "LOW" | "MODERATE" | "HIGH" | "ELITE" | null;
  personaGoalLabel: string | null;
  intentSummary: string;
  athletePersonaSummary: string;
  targetDistanceLabel: string | null;
  goalKind: "RACE" | "TRAINING_BLOCK";
  slug: string;
};

function strOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function validatePersonaDraft(
  raw: Record<string, unknown>,
  description: string,
): PersonaDraft {
  const capabilityRaw = strOrNull(raw.capability)?.toUpperCase() as AthletePersonaCapability | null;
  const capability =
    capabilityRaw && CAPABILITIES.has(capabilityRaw) ? capabilityRaw : "RECREATIONAL";

  const dedicationRaw = strOrNull(raw.dedication)?.toUpperCase();
  const dedication =
    dedicationRaw && DEDICATIONS.has(dedicationRaw)
      ? (dedicationRaw as PersonaDraft["dedication"])
      : null;

  const goalKindRaw = strOrNull(raw.goalKind)?.toLowerCase();
  const goalKind: PersonaDraft["goalKind"] =
    goalKindRaw === "trainingblock" || goalKindRaw === "training_block" ? "TRAINING_BLOCK" : "RACE";

  const targetDistanceLabel = strOrNull(raw.targetDistanceLabel);
  const intentSummary = strOrNull(raw.intentSummary) ?? description.trim();
  const athletePersonaSummary = strOrNull(raw.athletePersonaSummary) ?? intentSummary;
  const personaGoalLabel = strOrNull(raw.personaGoalLabel);
  const title =
    strOrNull(raw.title) ??
    [capability.toLowerCase(), targetDistanceLabel, personaGoalLabel].filter(Boolean).join(" · ");

  return {
    title,
    capability,
    dedication,
    personaGoalLabel,
    intentSummary,
    athletePersonaSummary,
    targetDistanceLabel,
    goalKind,
    slug: buildPersonaSlug({ capability, targetDistanceLabel, goalKind }),
  };
}

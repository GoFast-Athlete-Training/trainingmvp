import {
  buildPersonaSlug,
  capabilityToSlugPrefix,
  normalizeSlug,
} from "@/lib/training/plan-entity-slugs";
import { serializePlanPersona, type PlanPersonaApi } from "@/lib/training/plan-entity-serialize";
import { fetchProdPlanPersonas } from "@/lib/training/fetch-prod-plan-catalog";

const CAPABILITY_LABEL: Record<string, string> = {
  NON_RUNNER: "Non-runner",
  BEGINNER: "Beginner",
  RECREATIONAL: "Recreational",
  COMPETITIVE: "Competitive",
  ELITE: "Elite",
};

export type PersonaSuggestResult = {
  suggestedSlug: string;
  suggestedLabel: string;
  exactMatch: PlanPersonaApi | null;
  similar: PlanPersonaApi[];
};

export function buildSuggestedPersonaLabel(opts: {
  capability?: string | null;
  targetDistanceLabel?: string | null;
  personaGoalLabel?: string | null;
}): string {
  const cap =
    opts.capability && CAPABILITY_LABEL[opts.capability]
      ? CAPABILITY_LABEL[opts.capability]
      : "Runner";
  const tail =
    opts.personaGoalLabel?.trim() ||
    (opts.targetDistanceLabel?.trim() ? `${opts.targetDistanceLabel} focus` : "training focus");
  return `${cap} · ${tail}`;
}

export async function suggestPersonas(opts: {
  capability?: string | null;
  targetDistanceLabel?: string | null;
  goalKind?: string | null;
  personaGoalLabel?: string | null;
  suggestedSlug?: string | null;
  authorization: string;
  staffId: string;
}): Promise<PersonaSuggestResult> {
  const goalKind = opts.goalKind === "TRAINING_BLOCK" ? "TRAINING_BLOCK" : "RACE";

  const suggestedSlug =
    normalizeSlug(opts.suggestedSlug ?? "") ||
    buildPersonaSlug({
      capability: opts.capability as Parameters<typeof buildPersonaSlug>[0]["capability"],
      targetDistanceLabel: opts.targetDistanceLabel,
      goalKind,
    });

  const suggestedLabel = buildSuggestedPersonaLabel(opts);
  const personas = await fetchProdPlanPersonas({
    authorization: opts.authorization,
    staffId: opts.staffId,
  });

  const exactRow = personas.find((p) => p.slug === suggestedSlug) ?? null;
  const exactMatch = exactRow ? serializePlanPersona(exactRow) : null;

  const prefix = capabilityToSlugPrefix(opts.capability as Parameters<typeof capabilityToSlugPrefix>[0]);
  const similarRows = personas
    .filter((p) => (exactRow ? p.id !== exactRow.id : true))
    .filter(
      (p) =>
        (opts.capability && p.capability === opts.capability) ||
        p.slug.startsWith(prefix),
    )
    .slice(0, 5);

  return {
    suggestedSlug,
    suggestedLabel,
    exactMatch,
    similar: similarRows.map(serializePlanPersona),
  };
}

import type { AthletePersonaCapability } from "@prisma/client";

const SLUG_SAFE = /[^a-z0-9-]/g;

export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(SLUG_SAFE, "")
    .replace(/^-+|-+$/g, "");
}

const CAPABILITY_SLUG: Record<AthletePersonaCapability, string> = {
  NON_RUNNER: "new",
  BEGINNER: "new",
  RECREATIONAL: "rec",
  COMPETITIVE: "comp",
  ELITE: "elite",
};

export function capabilityToSlugPrefix(capability: AthletePersonaCapability | null | undefined): string {
  if (!capability) return "runner";
  return CAPABILITY_SLUG[capability] ?? "runner";
}

export function distanceToSlugPart(label: string | null | undefined): string {
  if (!label?.trim()) return "general";
  const t = label.trim().toLowerCase();
  if (t.includes("5k") || t === "5 k") return "5k";
  if (t.includes("10k") || t === "10 k") return "10k";
  if (t.includes("half")) return "half";
  if (t.includes("marathon")) return "marathon";
  return normalizeSlug(t) || "general";
}

export function goalKindToSlugPart(goalKind: "RACE" | "TRAINING_BLOCK" | null | undefined): string {
  if (goalKind === "TRAINING_BLOCK") return "block";
  return "improve";
}

export function buildPersonaSlug(opts: {
  capability?: AthletePersonaCapability | null;
  targetDistanceLabel?: string | null;
  goalKind?: "RACE" | "TRAINING_BLOCK" | null;
  override?: string | null;
}): string {
  if (opts.override?.trim()) {
    const s = normalizeSlug(opts.override);
    if (s) return s;
  }
  const level = capabilityToSlugPrefix(opts.capability);
  const dist = distanceToSlugPart(opts.targetDistanceLabel);
  const kind = goalKindToSlugPart(opts.goalKind);
  return `${level}-${dist}-${kind}`;
}

export function buildGoalSlug(personaSlug: string, planDurationWeeks: number): string {
  const base = normalizeSlug(personaSlug) || "goal";
  const weeks = Math.max(1, Math.round(planDurationWeeks));
  return `${base}-${weeks}w`;
}

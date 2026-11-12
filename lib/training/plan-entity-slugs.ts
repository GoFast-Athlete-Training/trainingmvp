export type AthletePersonaCapability =
  | "NON_RUNNER"
  | "BEGINNER"
  | "RECREATIONAL"
  | "COMPETITIVE"
  | "ELITE";

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
  if (t.includes("marathon") && !t.includes("half")) return "marathon";
  if (t.includes("ultra")) return "ultra";
  return normalizeSlug(t).slice(0, 24) || "general";
}

export function buildPersonaSlug(opts: {
  capability?: AthletePersonaCapability | null;
  targetDistanceLabel?: string | null;
  goalKind?: "RACE" | "TRAINING_BLOCK";
}): string {
  const cap = capabilityToSlugPrefix(opts.capability);
  const dist = distanceToSlugPart(opts.targetDistanceLabel);
  const kind = opts.goalKind === "TRAINING_BLOCK" ? "block" : "race";
  return normalizeSlug(`${cap}-${dist}-${kind}`);
}

export function buildGoalSlug(personaSlug: string, planDurationWeeks: number): string {
  return normalizeSlug(`${personaSlug}-${planDurationWeeks}w`);
}

import { fetchProdPlanGoals, fetchProdPlanPersonas } from "@/lib/training/fetch-prod-plan-catalog";
import { normalizeSlug } from "@/lib/training/plan-entity-slugs";

export async function findPersonaBySlug(
  slug: string,
  auth: { authorization: string; staffId: string },
) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  const personas = await fetchProdPlanPersonas(auth);
  return personas.find((p) => p.slug === normalized) ?? null;
}

export async function findGoalBySlug(
  slug: string,
  auth: { authorization: string; staffId: string },
) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  const goals = await fetchProdPlanGoals(auth);
  return goals.find((g) => g.slug === normalized) ?? null;
}

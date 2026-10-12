import { prisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/training/plan-entity-slugs";

export async function findPersonaBySlug(slug: string) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  return prisma.training_plan_persona.findUnique({ where: { slug: normalized } });
}

export async function findGoalBySlug(slug: string) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  return prisma.training_plan_goal.findUnique({
    where: { slug: normalized },
    include: { persona: true },
  });
}

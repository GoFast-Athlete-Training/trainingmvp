import { prisma } from "@/lib/prisma";

export type GofastCompanyCopyInput = {
  id: string;
  name: string;
  slug: string;
};

export async function upsertGofastCompanyCopy(input: GofastCompanyCopyInput) {
  const id = input.id.trim();
  const name = input.name.trim();
  const slug = input.slug.trim();

  if (!id || !name || !slug) {
    throw new Error("id, name, and slug are required for gofast company copy");
  }

  return prisma.gofast_companies.upsert({
    where: { id },
    update: { name, slug },
    create: { id, name, slug },
  });
}

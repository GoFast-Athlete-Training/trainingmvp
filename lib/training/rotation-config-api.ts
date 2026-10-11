import { prisma } from "@/lib/prisma";

type ConfigKind = "easy" | "tempo" | "intervals";

const listInclude = {
  _count: {
    select: {
      positions: true,
      usedByPresets: true,
      usedByBuildPresets: true,
      usedByTaperPresets: true,
    },
  },
} as const;

export async function listRotationConfigs(kind: ConfigKind) {
  if (kind === "easy") {
    return prisma.easy_config.findMany({
      orderBy: { name: "asc" },
      include: listInclude,
    });
  }
  if (kind === "tempo") {
    return prisma.tempo_config.findMany({
      orderBy: { name: "asc" },
      include: listInclude,
    });
  }
  return prisma.intervals_config.findMany({
    orderBy: { name: "asc" },
    include: listInclude,
  });
}

export async function deleteRotationConfig(kind: ConfigKind, id: string): Promise<boolean> {
  if (kind === "easy") {
    const ex = await prisma.easy_config.findUnique({ where: { id } });
    if (!ex) return false;
    await prisma.easy_config.delete({ where: { id } });
    return true;
  }
  if (kind === "tempo") {
    const ex = await prisma.tempo_config.findUnique({ where: { id } });
    if (!ex) return false;
    await prisma.tempo_config.delete({ where: { id } });
    return true;
  }
  const ex = await prisma.intervals_config.findUnique({ where: { id } });
  if (!ex) return false;
  await prisma.intervals_config.delete({ where: { id } });
  return true;
}

export async function createRotationConfig(kind: ConfigKind, name: string, positionCount = 4) {
  const count = Math.max(1, Math.min(4, positionCount));
  const slotData = Array.from({ length: count }, (_, i) => ({
    cyclePosition: i,
    distributionWeight: 1 / count,
  }));

  if (kind === "easy") {
    return prisma.easy_config.create({
      data: { name, positions: { create: slotData } },
      include: { positions: { orderBy: { cyclePosition: "asc" } } },
    });
  }
  if (kind === "tempo") {
    return prisma.tempo_config.create({
      data: { name, positions: { create: slotData } },
      include: { positions: { orderBy: { cyclePosition: "asc" } } },
    });
  }
  return prisma.intervals_config.create({
    data: { name, positions: { create: slotData } },
    include: { positions: { orderBy: { cyclePosition: "asc" } } },
  });
}

export async function getRotationConfig(kind: ConfigKind, id: string) {
  if (kind === "easy") {
    return prisma.easy_config.findUnique({
      where: { id },
      include: { positions: { orderBy: { cyclePosition: "asc" } } },
    });
  }
  if (kind === "tempo") {
    return prisma.tempo_config.findUnique({
      where: { id },
      include: { positions: { orderBy: { cyclePosition: "asc" } } },
    });
  }
  return prisma.intervals_config.findUnique({
    where: { id },
    include: { positions: { orderBy: { cyclePosition: "asc" } } },
  });
}

export async function patchRotationConfig(
  kind: ConfigKind,
  id: string,
  body: {
    name?: string;
    positions?: Array<{
      cyclePosition: number;
      catalogueWorkoutId?: string | null;
      distributionWeight?: number;
    }>;
  },
) {
  if (typeof body.name === "string") {
    if (kind === "easy") await prisma.easy_config.update({ where: { id }, data: { name: body.name.trim() } });
    else if (kind === "tempo") await prisma.tempo_config.update({ where: { id }, data: { name: body.name.trim() } });
    else await prisma.intervals_config.update({ where: { id }, data: { name: body.name.trim() } });
  }

  if (Array.isArray(body.positions)) {
    for (const pos of body.positions) {
      const data = {
        catalogueWorkoutId: pos.catalogueWorkoutId ?? null,
        ...(typeof pos.distributionWeight === "number"
          ? { distributionWeight: pos.distributionWeight }
          : {}),
      };
      if (kind === "easy") {
        await prisma.easy_config_position.updateMany({
          where: { easyConfigId: id, cyclePosition: pos.cyclePosition },
          data,
        });
      } else if (kind === "tempo") {
        await prisma.tempo_config_position.updateMany({
          where: { tempoConfigId: id, cyclePosition: pos.cyclePosition },
          data,
        });
      } else {
        await prisma.intervals_config_position.updateMany({
          where: { intervalsConfigId: id, cyclePosition: pos.cyclePosition },
          data,
        });
      }
    }
  }

  return getRotationConfig(kind, id);
}

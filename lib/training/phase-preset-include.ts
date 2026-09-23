export const buildPresetInclude = {
  longRunConfig: { select: { id: true, name: true } },
  easyConfig: { select: { id: true, name: true } },
  tempoConfig: { select: { id: true, name: true } },
  intervalsConfig: { select: { id: true, name: true } },
} as const;

export const taperPresetInclude = {
  longRunConfig: { select: { id: true, name: true } },
  easyConfig: { select: { id: true, name: true } },
  tempoConfig: { select: { id: true, name: true } },
  intervalsConfig: { select: { id: true, name: true } },
} as const;

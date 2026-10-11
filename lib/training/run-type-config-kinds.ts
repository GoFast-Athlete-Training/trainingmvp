export type RotationKind = "long-run" | "easy" | "tempo" | "intervals";

export const ROTATION_KINDS: {
  id: RotationKind;
  label: string;
  apiSegment: string;
  workoutType: "LongRun" | "Easy" | "Tempo" | "Intervals";
}[] = [
  { id: "long-run", label: "Long run", apiSegment: "long-run-config", workoutType: "LongRun" },
  { id: "easy", label: "Easy", apiSegment: "easy-config", workoutType: "Easy" },
  { id: "tempo", label: "Tempo", apiSegment: "tempo-config", workoutType: "Tempo" },
  { id: "intervals", label: "Intervals", apiSegment: "intervals-config", workoutType: "Intervals" },
];

export function rotationKindFromApiSegment(segment: string): RotationKind | null {
  return ROTATION_KINDS.find((k) => k.apiSegment === segment)?.id ?? null;
}

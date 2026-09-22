import { normalizeOperatorFirebaseUid } from "@/lib/auth/firebase-uid-normalize";

export const FIREBASE_LINK_REQUIRED_MESSAGE =
  "Staff has no linked Firebase account yet — they must sign in to Company HQ before assign";

export function resolveAssignFirebaseUid(input: {
  firebaseUid?: string | null;
  firebaseId?: string | null;
}): string | null {
  return normalizeOperatorFirebaseUid(input.firebaseUid ?? input.firebaseId);
}

import {
  FIREBASE_LINK_REQUIRED_MESSAGE,
  resolveAssignFirebaseUid,
} from "@/lib/staff-firebase-status";

export type AssignFirebaseInput = {
  firebaseUid?: string | null;
  firebaseId?: string | null;
};

export type AssignFirebaseResult =
  | { ok: true; firebaseUid: string }
  | { ok: false; status: 409; error: string };

export function resolveRequiredAssignFirebaseUid(input: AssignFirebaseInput): AssignFirebaseResult {
  const firebaseUid = resolveAssignFirebaseUid(input);
  if (!firebaseUid) {
    return { ok: false, status: 409, error: FIREBASE_LINK_REQUIRED_MESSAGE };
  }
  return { ok: true, firebaseUid };
}

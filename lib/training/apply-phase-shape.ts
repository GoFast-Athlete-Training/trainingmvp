import { forwardProdPresetStaffRequest } from "@/lib/training/prod-preset-staff-proxy";
import {
  PHASE_ROLES,
  SLOT_KINDS,
  type PhasePointerField,
  type SlotColumn,
  type SlotKind,
} from "@/lib/training/preset-shape-columns";

export type ProdStaffCredentials = {
  authorization: string;
  staffId: string;
};

export type PhaseShapeResult = {
  errors: string[];
  pointers: Partial<Record<PhasePointerField, string | null>>;
};

const ROTATION_LIST_PATH: Record<SlotKind, string> = {
  longRun: "/api/training/long-run-config",
  easy: "/api/training/easy-config",
  tempo: "/api/training/tempo-config",
  intervals: "/api/training/intervals-config",
};

const SLOT_LABEL: Record<SlotKind, string> = {
  longRun: "long run",
  easy: "easy",
  tempo: "tempo",
  intervals: "intervals",
};

async function prodJson<T>(auth: ProdStaffCredentials, path: string, method: string, body?: unknown): Promise<T> {
  const res = await forwardProdPresetStaffRequest({
    authorization: auth.authorization,
    staffId: auth.staffId,
    path,
    method,
    body,
  });
  const json = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) {
    throw new Error(`Prod ${method} ${path} failed (${res.status})`);
  }
  return json;
}

async function listPhasePresets(auth: ProdStaffCredentials): Promise<{ id: string; name: string }[]> {
  const json = await prodJson<{ phasePresets?: { id: string; name: string }[] }>(
    auth,
    "/api/training/phase-preset",
    "GET",
  );
  return json.phasePresets ?? [];
}

async function listRotations(kind: SlotKind, auth: ProdStaffCredentials): Promise<{ id: string; name: string }[]> {
  const json = await prodJson<{ items?: { id: string; name: string }[] }>(
    auth,
    ROTATION_LIST_PATH[kind],
    "GET",
  );
  return json.items ?? [];
}

async function phaseIdByName(
  name: string,
  auth: ProdStaffCredentials,
  dryRun: boolean,
): Promise<string | null> {
  const phases = await listPhasePresets(auth);
  const hit = phases.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (hit) return hit.id;
  if (dryRun) return null;
  const created = await prodJson<{ phasePreset?: { id: string } }>(auth, "/api/training/phase-preset", "POST", {
    name,
  });
  return created.phasePreset?.id ?? null;
}

async function rotationId(kind: SlotKind, name: string, auth: ProdStaffCredentials): Promise<string | null> {
  const items = await listRotations(kind, auth);
  const hit = items.find((i) => i.name.toLowerCase() === name.toLowerCase());
  return hit?.id ?? null;
}

/**
 * Resolves phase preset names and rotation slots on prod (not Training Manage DB).
 */
export async function applyPhaseShapeFields(opts: {
  fields: Map<string, string>;
  currentPointers?: Partial<Record<PhasePointerField, string | null>>;
  dryRun?: boolean;
  prodStaff: ProdStaffCredentials;
}): Promise<PhaseShapeResult> {
  const dryRun = opts.dryRun === true;
  const auth = opts.prodStaff;
  const errors: string[] = [];
  const pointers: Partial<Record<PhasePointerField, string | null>> = {};
  const current = opts.currentPointers ?? {};

  const resolved: {
    role: (typeof PHASE_ROLES)[number];
    phaseId: string | null;
    willCreate: boolean;
  }[] = [];

  for (const role of PHASE_ROLES) {
    if (!opts.fields.has(role.nameField)) {
      resolved.push({
        role,
        phaseId: current[role.pointer] ?? null,
        willCreate: false,
      });
      continue;
    }
    const name = opts.fields.get(role.nameField)?.trim() ?? "";
    if (!name) {
      pointers[role.pointer] = null;
      resolved.push({ role, phaseId: null, willCreate: false });
      continue;
    }
    const existingId = await phaseIdByName(name, auth, true);
    if (existingId) {
      pointers[role.pointer] = existingId;
      resolved.push({ role, phaseId: existingId, willCreate: false });
    } else {
      pointers[role.pointer] = null;
      resolved.push({ role, phaseId: null, willCreate: true });
    }
  }

  type DesiredSlot = { name: string | null };
  const desiredByPhase = new Map<string, Partial<Record<SlotColumn, DesiredSlot>>>();
  const pendingCreates = new Map<string, Partial<Record<SlotColumn, DesiredSlot>>>();

  function bucketFor(roleKey: string, phaseId: string | null, willCreate: boolean) {
    if (phaseId) {
      let bucket = desiredByPhase.get(phaseId);
      if (!bucket) {
        bucket = {};
        desiredByPhase.set(phaseId, bucket);
      }
      return bucket;
    }
    if (!willCreate) return null;
    let bucket = pendingCreates.get(roleKey);
    if (!bucket) {
      bucket = {};
      pendingCreates.set(roleKey, bucket);
    }
    return bucket;
  }

  for (const item of resolved) {
    for (const slot of SLOT_KINDS) {
      const field = `${item.role.key}${slot.suffix}`;
      if (!opts.fields.has(field)) continue;
      const raw = opts.fields.get(field)?.trim() ?? "";
      if (!item.phaseId && !item.willCreate) {
        if (raw) errors.push(`${field} needs ${item.role.nameField}`);
        continue;
      }
      const bucket = bucketFor(item.role.key, item.phaseId, item.willCreate);
      if (!bucket) continue;
      const previous = bucket[slot.column];
      if (raw) {
        bucket[slot.column] = { name: raw };
      } else if (!previous?.name) {
        bucket[slot.column] = { name: null };
      }
    }
  }

  const resolvedSlots = new Map<string, Partial<Record<SlotColumn, string | null>>>();

  async function resolveBucket(
    key: string,
    bucket: Partial<Record<SlotColumn, DesiredSlot>>,
  ) {
    const next: Partial<Record<SlotColumn, string | null>> = {};
    for (const slot of SLOT_KINDS) {
      const desired = bucket[slot.column];
      if (!desired) continue;
      if (!desired.name) {
        next[slot.column] = null;
        continue;
      }
      const id = await rotationId(slot.kind, desired.name, auth);
      if (!id) {
        errors.push(`No ${SLOT_LABEL[slot.kind]} rotation named “${desired.name}”`);
        continue;
      }
      next[slot.column] = id;
    }
    resolvedSlots.set(key, next);
  }

  for (const [phaseId, bucket] of desiredByPhase) {
    await resolveBucket(phaseId, bucket);
  }
  for (const [roleKey, bucket] of pendingCreates) {
    await resolveBucket(`create:${roleKey}`, bucket);
  }

  if (dryRun || errors.length > 0) {
    return { errors, pointers };
  }

  const createdIds = new Map<string, string>();
  for (const item of resolved) {
    if (!item.willCreate) continue;
    const name = opts.fields.get(item.role.nameField)?.trim() ?? "";
    if (!name) continue;
    const shared = createdIds.get(name.toLowerCase());
    const id = shared ?? (await phaseIdByName(name, auth, false));
    if (!id) continue;
    createdIds.set(name.toLowerCase(), id);
    pointers[item.role.pointer] = id;
    const staged = resolvedSlots.get(`create:${item.role.key}`);
    if (staged && Object.keys(staged).length > 0) {
      const existing = resolvedSlots.get(id) ?? {};
      const merged: Partial<Record<SlotColumn, string | null>> = { ...existing };
      for (const slot of SLOT_KINDS) {
        const value = staged[slot.column];
        if (value === undefined) continue;
        if (value) merged[slot.column] = value;
        else if (!(slot.column in merged)) merged[slot.column] = null;
      }
      resolvedSlots.set(id, merged);
    }
  }

  for (const [phaseId, data] of resolvedSlots) {
    if (phaseId.startsWith("create:")) continue;
    if (Object.keys(data).length === 0) continue;
    const patchBody: Record<string, string | null> = {};
    for (const [col, value] of Object.entries(data)) {
      const key =
        col === "longRun"
          ? "longRunConfigId"
          : col === "easy"
            ? "easyConfigId"
            : col === "tempo"
              ? "tempoConfigId"
              : "intervalsConfigId";
      patchBody[key] = value ?? null;
    }
    await prodJson(
      auth,
      `/api/training/phase-preset/${encodeURIComponent(phaseId)}`,
      "PATCH",
      patchBody,
    );
  }

  return { errors, pointers };
}

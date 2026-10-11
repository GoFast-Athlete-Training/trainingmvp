"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch } from "@/components/AppProviders";
import { ROTATION_KINDS, type RotationKind } from "@/lib/training/run-type-config-kinds";
import { useCallback, useEffect, useState } from "react";

type ConfigCounts = {
  positions: number;
  usedByPresets: number;
  usedByBuildPresets: number;
  usedByTaperPresets: number;
};

type RotationRow = {
  id: string;
  name: string;
  description?: string | null;
  _count?: ConfigCounts;
  positions?: Array<{ cyclePosition: number }>;
};

type ShakeoutRow = { id: string; name: string; totalMiles: number; paceOffsetSecPerMile: number };

type Tab = RotationKind | "shakeout";

function linkedCount(counts?: ConfigCounts): number {
  if (!counts) return 0;
  return counts.usedByPresets + counts.usedByBuildPresets + counts.usedByTaperPresets;
}

function slotCount(row: RotationRow): number {
  return row._count?.positions ?? row.positions?.length ?? 0;
}

export default function RunTypeConfigHubPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("long-run");
  const [rotations, setRotations] = useState<Record<RotationKind, RotationRow[]>>({
    "long-run": [],
    easy: [],
    tempo: [],
    intervals: [],
  });
  const [shakeouts, setShakeouts] = useState<ShakeoutRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    const [lr, easy, tempo, intervals, shake] = await Promise.all([
      authFetch("/api/training/long-run-config").then((r) => r.json()),
      authFetch("/api/training/easy-config").then((r) => r.json()),
      authFetch("/api/training/tempo-config").then((r) => r.json()),
      authFetch("/api/training/intervals-config").then((r) => r.json()),
      authFetch("/api/training/shakeout-run-config").then((r) => r.json()),
    ]);
    setRotations({
      "long-run": lr.configs ?? [],
      easy: easy.configs ?? [],
      tempo: tempo.configs ?? [],
      intervals: intervals.configs ?? [],
    });
    setShakeouts(shake.configs ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRotation() {
    const trimmed = newName.trim();
    if (!trimmed || tab === "shakeout") return;
    const kind = ROTATION_KINDS.find((k) => k.id === tab)!;
    setCreating(true);
    setError(null);
    try {
      const res = await authFetch(`/api/training/${kind.apiSegment}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, positionCount: 4 }),
      });
      const data = (await res.json()) as { config?: { id: string } };
      if (data.config?.id) {
        router.push(`/dashboard/long-run-config/${kind.id}/${data.config.id}`);
      } else {
        await load();
      }
      setNewName("");
    } finally {
      setCreating(false);
    }
  }

  async function createShakeout() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    setError(null);
    try {
      const res = await authFetch("/api/training/shakeout-run-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, totalMiles: 3, paceOffsetSecPerMile: 0 }),
      });
      const data = (await res.json()) as { config?: { id: string } };
      if (data.config?.id) {
        router.push(`/dashboard/long-run-config/shakeout/${data.config.id}`);
      } else {
        await load();
      }
      setNewName("");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(apiPath: string, id: string, name: string) {
    if (
      !window.confirm(
        `Delete "${name}"? Linked presets and phases will be unlinked (not deleted).`,
      )
    ) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      const res = await authFetch(`${apiPath}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Delete failed");
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const activeKind = ROTATION_KINDS.find((k) => k.id === tab);
  const rotationList = tab !== "shakeout" ? rotations[tab] : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-1">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Run Type Config</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Rotations bolt onto build and taper presets. Shakeout configs set pace offset for
          race-week shakeout rows.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {ROTATION_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setTab(k.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === k.id ? "bg-sky-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {k.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTab("shakeout")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "shakeout" ? "bg-sky-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Shakeout
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-800">
          {tab === "shakeout" ? "New shakeout config" : `New ${activeKind?.label ?? ""} rotation`}
        </h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label className="text-xs text-gray-500">Name</label>
            <input
              className="mt-0.5 w-full max-w-md rounded border border-gray-300 px-3 py-2 text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void (tab === "shakeout" ? createShakeout() : createRotation());
              }}
            />
          </div>
          <button
            type="button"
            disabled={creating || !newName.trim()}
            onClick={() => void (tab === "shakeout" ? createShakeout() : createRotation())}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </section>

      {tab === "shakeout" ? (
        shakeouts.length === 0 ? (
          <p className="text-sm text-gray-500">No shakeout configs yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {shakeouts.map((row) => (
              <ConfigCard
                key={row.id}
                title={row.name}
                meta={`${row.totalMiles} mi · pace offset ${row.paceOffsetSecPerMile} sec/mi`}
                editHref={`/dashboard/long-run-config/shakeout/${row.id}`}
                deleting={deletingId === row.id}
                onDelete={() =>
                  void handleDelete("/api/training/shakeout-run-config", row.id, row.name)
                }
              />
            ))}
          </div>
        )
      ) : rotationList.length === 0 ? (
        <p className="text-sm text-gray-500">No rotations yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rotationList.map((row) => {
            const kind = ROTATION_KINDS.find((k) => k.id === tab)!;
            const linked = linkedCount(row._count);
            const slots = slotCount(row);
            return (
              <ConfigCard
                key={row.id}
                title={row.name}
                description={row.description}
                meta={`${slots} slot${slots === 1 ? "" : "s"} · linked on ${linked} preset${
                  linked === 1 ? "" : "s"
                } / phase${linked === 1 ? "" : "s"}`}
                editHref={`/dashboard/long-run-config/${tab}/${row.id}`}
                deleting={deletingId === row.id}
                onDelete={() =>
                  void handleDelete(`/api/training/${kind.apiSegment}`, row.id, row.name)
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConfigCard({
  title,
  description,
  meta,
  editHref,
  deleting,
  onDelete,
}: {
  title: string;
  description?: string | null;
  meta: string;
  editHref: string;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="group relative flex min-h-[140px] flex-col rounded-lg border border-gray-200 bg-white shadow-sm transition hover:border-gray-300 hover:shadow-md">
      <div className="flex flex-1 flex-col p-5 pr-14">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        {description ? (
          <p className="mt-2 line-clamp-2 text-sm text-gray-600">{description}</p>
        ) : null}
        <p className="mt-auto pt-3 text-xs text-gray-500">{meta}</p>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-2">
        <Link
          href={editHref}
          className="text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
        >
          Edit
        </Link>
        <button
          type="button"
          disabled={deleting}
          onClick={onDelete}
          className="text-sm text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

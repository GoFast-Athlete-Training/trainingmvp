"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import {
  PhaseRotationBolts,
  type PhaseRotationIds,
} from "@/components/training-manager/PhaseRotationBolts";
import { useCallback, useEffect, useState } from "react";

type PhasePreset = {
  id: string;
  name: string;
  description: string | null;
  longRunConfigId: string | null;
  easyConfigId: string | null;
  tempoConfigId: string | null;
  intervalsConfigId: string | null;
};

export default function PhasePresetEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rotations, setRotations] = useState<PhaseRotationIds>({
    longRunConfigId: "",
    easyConfigId: "",
    tempoConfigId: "",
    intervalsConfigId: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await authFetch(`/api/training/phase-preset/${id}`);
    const data = (await res.json()) as { phasePreset?: PhasePreset };
    const row = data.phasePreset;
    if (!row) return;
    setName(row.name);
    setDescription(row.description ?? "");
    setRotations({
      longRunConfigId: row.longRunConfigId ?? "",
      easyConfigId: row.easyConfigId ?? "",
      tempoConfigId: row.tempoConfigId ?? "",
      intervalsConfigId: row.intervalsConfigId ?? "",
    });
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!id) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await authFetch(`/api/training/phase-preset/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Phase",
          description: description.trim() || null,
          longRunConfigId: rotations.longRunConfigId || null,
          easyConfigId: rotations.easyConfigId || null,
          tempoConfigId: rotations.tempoConfigId || null,
          intervalsConfigId: rotations.intervalsConfigId || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      setMessage(res.ok ? "Saved" : data.error || `Save failed (${res.status})`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard/phase-presets" className="text-sm text-sky-700 hover:underline">
        ← Phase presets
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{name.trim() || "Phase preset"}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Name, description, and one rotation for each slot. A slot can stay empty.
        </p>
      </div>
      <label className="block text-sm">
        <span className="text-gray-600">Name</span>
        <input
          className="mt-1 w-full max-w-md rounded border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="text-gray-600">Description</span>
        <textarea
          className="mt-1 w-full max-w-md rounded border px-3 py-2"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <PhaseRotationBolts value={rotations} onChange={setRotations} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {message ? <p className="text-sm text-gray-600">{message}</p> : null}
      </div>
      <p className="text-sm text-gray-500">
        Workouts inside a slot live in the{" "}
        <Link href="/dashboard/catalogue" className="font-medium text-sky-700 hover:underline">
          workout catalogue
        </Link>
        , opened from Run Type Config.
      </p>
    </div>
  );
}

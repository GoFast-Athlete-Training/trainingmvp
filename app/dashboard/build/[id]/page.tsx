"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import {
  BuildPhaseFields,
  buildFormFromApi,
  buildPatchBody,
  type BuildFormState,
} from "@/components/training-manager/BuildPhaseFields";
import { useCallback, useEffect, useState } from "react";

export default function BuildEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState<BuildFormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await authFetch(`/api/training/build-preset/${id}`);
    const data = (await res.json()) as { build?: Parameters<typeof buildFormFromApi>[0] };
    if (data.build) setForm(buildFormFromApi(data.build));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await authFetch(`/api/training/build-preset/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPatchBody(form)),
      });
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard/build" className="text-sm text-sky-700 hover:underline">
        ← Build presets
      </Link>
      <h1 className="text-2xl font-bold">Build preset</h1>
      <BuildPhaseFields value={form} onChange={setForm} />
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

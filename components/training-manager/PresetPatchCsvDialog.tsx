"use client";

import { authFetch } from "@/components/AppProviders";
import type { PresetPatchPreview } from "@/lib/training/preset-patch-csv";
import { AlertTriangle, Check, Download, Loader2, Upload, X } from "lucide-react";
import { useCallback, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  presetId: string;
  onApplied?: () => void;
};

export default function PresetPatchCsvDialog({ open, onClose, presetId, onApplied }: Props) {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<PresetPatchPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [applyDone, setApplyDone] = useState(false);

  const resetState = useCallback(() => {
    setCsvText("");
    setPreview(null);
    setError(null);
    setApplyDone(false);
  }, []);

  if (!open) return null;

  const close = () => {
    resetState();
    onClose();
  };

  const downloadCurrent = async () => {
    setBusy("download");
    setError(null);
    try {
      const res = await authFetch(`/api/training/plan-preset/${presetId}/patch-csv/export`);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error || `Download failed (${res.status})`);
        return;
      }
      const text = await res.text();
      setCsvText(text);
      setPreview(null);
      setApplyDone(false);
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setCsvText(await file.text());
    setPreview(null);
    setApplyDone(false);
    setError(null);
  };

  const runPreview = async () => {
    setBusy("preview");
    setError(null);
    try {
      const res = await authFetch(`/api/training/plan-preset/${presetId}/patch-csv/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const data = (await res.json()) as { preview?: PresetPatchPreview; error?: string };
      if (!res.ok) {
        setError(data.error || `Preview failed (${res.status})`);
        return;
      }
      setPreview(data.preview ?? null);
      if (data.preview?.errors?.length) {
        setError(data.preview.errors.join("; "));
      }
    } finally {
      setBusy(null);
    }
  };

  const parsePaste = async () => {
    if (!csvText.trim()) return;
    setBusy("parse");
    setError(null);
    try {
      const res = await authFetch(`/api/training/plan-preset/${presetId}/patch-csv/parse-paste`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pasteText: csvText }),
      });
      const data = (await res.json()) as { csvText?: string; errors?: string[]; error?: string };
      if (!res.ok) {
        setError(data.error || data.errors?.join("; ") || `Parse failed (${res.status})`);
        return;
      }
      if (data.csvText) setCsvText(data.csvText);
      setPreview(null);
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    setBusy("apply");
    setError(null);
    try {
      const res = await authFetch(`/api/training/plan-preset/${presetId}/patch-csv/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const data = (await res.json()) as { error?: string; preview?: PresetPatchPreview };
      if (!res.ok) {
        setError(data.error || `Apply failed (${res.status})`);
        if (data.preview) setPreview(data.preview);
        return;
      }
      setApplyDone(true);
      onApplied?.();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="relative z-[201] flex max-h-[min(92vh,820px)] w-full max-w-3xl flex-col rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Patch from CSV</h2>
            <p className="mt-1 text-sm text-gray-600">
              Download current data, validate in your LLM, edit <code className="text-xs">value</code>{" "}
              cells only, then preview and apply. Blank value keeps what is on file.
            </p>
          </div>
          <button type="button" onClick={close} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void downloadCurrent()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-50"
          >
            {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download current CSV
          </button>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50">
              <Upload className="h-4 w-4" />
              Upload CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              disabled={busy != null || !csvText.trim()}
              onClick={() => void parsePaste()}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === "parse" ? "Parsing…" : "Convert LLM notes to CSV"}
            </button>
          </div>

          <textarea
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setPreview(null);
              setApplyDone(false);
              setError(null);
            }}
            rows={10}
            className="w-full rounded-lg border border-gray-300 font-mono text-xs text-gray-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="Paste field,value CSV or LLM prose to convert…"
          />

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {applyDone ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <Check className="h-4 w-4" />
              Patch applied and synced to prod.
            </div>
          ) : null}

          {preview && preview.changes.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              {preview.changes.map((c) => (
                <li key={c.field}>
                  <span className="font-mono text-xs text-gray-600">{c.field}</span>: {c.before || "—"} →{" "}
                  <span className="font-medium">{c.after}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            type="button"
            disabled={busy != null || !csvText.trim()}
            onClick={() => void runPreview()}
            className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-50"
          >
            {busy === "preview" ? "Previewing…" : "Preview"}
          </button>
          <button
            type="button"
            disabled={busy != null || !csvText.trim() || (preview?.errors?.length ?? 0) > 0}
            onClick={() => void apply()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy === "apply" ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch } from "@/components/AppProviders";
import IntakeModePicker, { type IntakeMode } from "@/components/training-manager/IntakeModePicker";
import {
  EMPTY_PRESET_INGEST_ROW,
  PRESET_INGEST_CSV_COLUMNS,
  parsePresetIngestCsv,
  validatePresetIngestRow,
  type PresetIngestPreviewRow,
  type PresetIngestRowInput,
} from "@/lib/training/preset-ingest-canon";
import { TARGET_DISTANCE_OPTIONS } from "@/lib/training/race-distance-presets";
import { useCallback, useMemo, useState } from "react";

function numInput(
  row: PresetIngestRowInput,
  key: keyof PresetIngestRowInput,
  value: string,
): PresetIngestRowInput {
  const t = value.trim();
  const n = t === "" ? null : Number(t);
  return { ...row, [key]: n != null && Number.isFinite(n) ? n : null };
}

function PresetIngestPreviewTable({
  rows,
  showRowIndex,
}: {
  rows: PresetIngestPreviewRow[];
  showRowIndex?: boolean;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase text-gray-500">
          <tr>
            {showRowIndex ? <th className="px-3 py-2">Row</th> : null}
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Distance</th>
            <th className="px-3 py-2">Miles band</th>
            <th className="px-3 py-2">Long run</th>
            <th className="px-3 py-2">Preview-only</th>
            <th className="px-3 py-2">Errors</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.rowIndex} className={r.valid ? "" : "bg-red-50/40"}>
              {showRowIndex ? (
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{r.rowIndex}</td>
              ) : null}
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.valid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {r.valid ? "OK" : "Error"}
                </span>
              </td>
              <td className="px-3 py-2 font-medium">{r.row.title || "—"}</td>
              <td className="px-3 py-2">{r.row.targetDistance || "—"}</td>
              <td className="px-3 py-2 text-gray-600">
                {r.row.minWeeklyMiles ?? "—"}–{r.row.maxWeeklyMiles ?? "—"} mpw
              </td>
              <td className="px-3 py-2 text-gray-600">
                {r.row.startLongRunMiles ?? "—"} → {r.row.peakLongRunMiles ?? "—"} mi
              </td>
              <td className="px-3 py-2 text-xs text-amber-800">
                {r.notStoredYet.length === 0 ? (
                  <span className="text-gray-400">—</span>
                ) : (
                  <ul className="space-y-1">
                    {r.notStoredYet.map((n) => (
                      <li key={n.field}>
                        <span className="font-medium">{n.label}</span>={n.value}{" "}
                        <span className="italic text-amber-600">not stored yet</span>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-red-700">
                {r.errors.length ? r.errors.join("; ") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManualPresetForm({
  row,
  onChange,
  onPreview,
}: {
  row: PresetIngestRowInput;
  onChange: (row: PresetIngestRowInput) => void;
  onPreview: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <PresetIngestFields row={row} onChange={onChange} idPrefix="manual" />
      <button
        type="button"
        onClick={onPreview}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Review row
      </button>
    </div>
  );
}

function PresetIngestFields({
  row,
  onChange,
  idPrefix,
}: {
  row: PresetIngestRowInput;
  onChange: (row: PresetIngestRowInput) => void;
  idPrefix: string;
}) {
  const fields: {
    key: keyof PresetIngestRowInput;
    label: string;
    type: "text" | "number" | "select";
    previewOnly?: boolean;
  }[] = [
    { key: "title", label: "title", type: "text" },
    { key: "targetDistance", label: "targetDistance", type: "select" },
    { key: "minWeeklyMiles", label: "minWeeklyMiles", type: "number" },
    { key: "maxWeeklyMiles", label: "maxWeeklyMiles", type: "number" },
    { key: "startLongRunMiles", label: "startLongRunMiles", type: "number" },
    { key: "peakLongRunMiles", label: "peakLongRunMiles", type: "number" },
    { key: "personaSlug", label: "personaSlug (optional)", type: "text" },
    { key: "durationWeeks", label: "durationWeeks", type: "number", previewOnly: true },
    {
      key: "suggestedEasyOffsetSec",
      label: "suggestedEasyOffsetSec",
      type: "number",
      previewOnly: true,
    },
    {
      key: "suggestedLongRunOffsetSec",
      label: "suggestedLongRunOffsetSec",
      type: "number",
      previewOnly: true,
    },
    {
      key: "suggestedThresholdOffsetSec",
      label: "suggestedThresholdOffsetSec",
      type: "number",
      previewOnly: true,
    },
    {
      key: "suggestedIntervalOffsetSec",
      label: "suggestedIntervalOffsetSec",
      type: "number",
      previewOnly: true,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <label key={f.key} className="block text-sm">
          <span className="font-medium text-gray-800">
            {f.label}
            {f.previewOnly ? (
              <span className="ml-1 text-xs font-normal italic text-amber-700">preview only</span>
            ) : null}
          </span>
          {f.type === "select" ? (
            <select
              id={`${idPrefix}-${f.key}`}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              value={row.targetDistance}
              onChange={(e) => onChange({ ...row, targetDistance: e.target.value })}
            >
              {TARGET_DISTANCE_OPTIONS.map((d) => (
                <option key={d || "none"} value={d}>
                  {d || "— Select distance —"}
                </option>
              ))}
            </select>
          ) : f.type === "number" ? (
            <input
              id={`${idPrefix}-${f.key}`}
              type="number"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              value={row[f.key] === null ? "" : String(row[f.key])}
              onChange={(e) => onChange(numInput(row, f.key, e.target.value))}
            />
          ) : (
            <input
              id={`${idPrefix}-${f.key}`}
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              value={String(row[f.key] ?? "")}
              onChange={(e) => onChange({ ...row, [f.key]: e.target.value })}
            />
          )}
        </label>
      ))}
    </div>
  );
}

export default function PresetIngestPage() {
  const router = useRouter();
  const [mode, setMode] = useState<IntakeMode | null>(null);
  const [manualRow, setManualRow] = useState<PresetIngestRowInput>(EMPTY_PRESET_INGEST_ROW);
  const [pasteText, setPasteText] = useState("");
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [previews, setPreviews] = useState<PresetIngestPreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const validCount = useMemo(() => previews.filter((p) => p.valid).length, [previews]);

  const resetPreview = useCallback(() => {
    setPreviews([]);
    setImportMessage(null);
    setImportError(null);
  }, []);

  async function downloadTemplate() {
    const res = await authFetch("/api/training/plan-preset/ingest/template");
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plan-preset-ingest-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onCsvFile(file: File | null) {
    resetPreview();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsvText(text);
      const parsed = parsePresetIngestCsv(text);
      setFileErrors(parsed.fileErrors);
      setPreviews(parsed.rows);
    };
    reader.readAsText(file);
  }

  async function parsePaste() {
    resetPreview();
    setBusy(true);
    try {
      const res = await authFetch("/api/training/plan-preset/ingest/parse-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        rows?: PresetIngestPreviewRow[];
        error?: string;
      };
      if (!res.ok || !data.success) {
        setImportError(data.error || `Parse failed (${res.status})`);
        return;
      }
      setPreviews(data.rows ?? []);
    } finally {
      setBusy(false);
    }
  }

  function reviewManualRow() {
    resetPreview();
    const preview = validatePresetIngestRow(manualRow, 1);
    setPreviews([preview]);
  }

  async function importValidRows(openEditorAfterSingle: boolean) {
    const toImport = previews.filter((p) => p.valid).map((p) => p.row);
    if (toImport.length === 0) {
      setImportError("No valid rows to import.");
      return;
    }

    setBusy(true);
    setImportError(null);
    setImportMessage(null);
    try {
      const res = await authFetch("/api/training/plan-preset/ingest/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: toImport, importValidOnly: true }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        imported?: number;
        skipped?: number;
        results?: { rowIndex: number; ok: boolean; presetId?: string; error?: string }[];
        error?: string;
      };
      if (!res.ok) {
        setImportError(data.error || `Import failed (${res.status})`);
        return;
      }

      const imported = data.imported ?? 0;
      setImportMessage(`Imported ${imported} preset${imported === 1 ? "" : "s"} to prod.`);

      const firstOk = data.results?.find((r) => r.ok && r.presetId);
      if (openEditorAfterSingle && imported === 1 && firstOk?.presetId) {
        router.push(`/dashboard/presets/${firstOk.presetId}`);
        return;
      }
      router.push("/dashboard/presets");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Import plan presets</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manual entry, AI paste, or CSV. Stored fields write to prod with a linked build preset
            for long-run start and peak miles.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Columns: {PRESET_INGEST_CSV_COLUMNS.join(", ")}
          </p>
        </div>
        <Link href="/dashboard/presets" className="text-sm font-medium text-sky-700 hover:underline">
          ← Presets list
        </Link>
      </div>

      <IntakeModePicker mode={mode} onChange={(m) => { setMode(m); resetPreview(); }} />

      {mode === "manual" ? (
        <ManualPresetForm row={manualRow} onChange={setManualRow} onPreview={reviewManualRow} />
      ) : null}

      {mode === "paste" ? (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <label className="block text-sm font-medium text-gray-800">
            Paste notes, outline, or a messy list
          </label>
          <textarea
            className="min-h-[180px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="e.g. Marathon template 55–70 mpw, long run builds 10 to 22, 18 weeks…"
          />
          <button
            type="button"
            disabled={busy || !pasteText.trim()}
            onClick={() => void parsePaste()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {busy ? "Parsing…" : "Parse with AI"}
          </button>
        </div>
      ) : null}

      {mode === "csv" ? (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void downloadTemplate()}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Download template
            </button>
            <label className="inline-flex cursor-pointer items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
              Upload CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onCsvFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {csvText ? (
            <p className="text-xs text-gray-500">Loaded {previews.length} data row(s).</p>
          ) : null}
          {fileErrors.length > 0 ? (
            <ul className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {fileErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {previews.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              Preview ({validCount} valid / {previews.length} total)
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || validCount === 0}
                onClick={() => void importValidRows(false)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {busy ? "Importing…" : "Import valid rows"}
              </button>
              {mode === "manual" && validCount === 1 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void importValidRows(true)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  Import and open editor
                </button>
              ) : null}
            </div>
          </div>
          <PresetIngestPreviewTable rows={previews} showRowIndex={mode !== "manual"} />
        </section>
      ) : null}

      {importMessage ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {importMessage}
        </p>
      ) : null}
      {importError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {importError}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { CheckCircle, Sparkles } from "lucide-react";

type Props = {
  description: string;
  onDescriptionChange: (value: string) => void;
  busy: boolean;
  onGenerate: () => void;
  /** True after AI parse filled the form (not manual ?new= prefill notice). */
  parsedReady: boolean;
  onStartOver: () => void;
};

export function CataloguePasteIngestPanel({
  description,
  onDescriptionChange,
  busy,
  onGenerate,
  parsedReady,
  onStartOver,
}: Props) {
  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div
        className="flex border-b border-gray-200"
        role="tablist"
        aria-label="Catalogue AI modes"
      >
        <div
          className="flex min-w-0 flex-1 items-center justify-center gap-2 border-b-2 border-purple-600 bg-purple-50/60 px-3 py-2.5 text-sm font-medium text-gray-900"
          role="tab"
          aria-selected
        >
          <Sparkles className="h-4 w-4 shrink-0 text-purple-500" />
          <span>Paste / parse</span>
        </div>
      </div>

      {parsedReady ? (
        <section className="border-t-0 p-4 sm:p-5" role="tabpanel" aria-label="Paste / parse">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-purple-200 bg-purple-50/90 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-purple-950">
              <CheckCircle className="h-4 w-4 shrink-0 text-purple-600" />
              Entry pre-filled below — review and save.
            </p>
            <button
              type="button"
              className="text-sm font-medium text-purple-800 underline underline-offset-2 hover:text-purple-950"
              onClick={onStartOver}
            >
              Start over
            </button>
          </div>
        </section>
      ) : (
        <section className="border-t-0 p-4 sm:p-5" role="tabpanel" aria-label="Paste / parse">
          <p className="mb-2 text-sm text-gray-600">
            You already have workout text — AI parses it into structured catalogue fields. Review and
            save.
          </p>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={3}
            className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder='e.g. "Tempo run. 1 mile easy warmup, 2 miles at marathon pace + 30 sec/mi, 1 mile cooldown. Build phase."'
          />
          <button
            type="button"
            disabled={busy || !description.trim()}
            onClick={onGenerate}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {busy ? "Parsing…" : "Generate entry"}
          </button>
        </section>
      )}
    </div>
  );
}

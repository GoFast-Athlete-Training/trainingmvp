"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardCopy, Loader2, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  promptText: string;
  title?: string;
};

export default function PresetValidateLlmDialog({
  open,
  onClose,
  promptText,
  title = "LLM preset check",
}: Props) {
  const [copyBusy, setCopyBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) setCopied(false);
  }, [open, promptText]);

  if (!open) return null;

  const copy = async () => {
    setCopyBusy(true);
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
    } catch {
      setCopied(false);
    } finally {
      setCopyBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="preset-validate-llm-title"
        className="relative z-[201] flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col rounded-xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id="preset-validate-llm-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Paste into your LLM. Compare copy and mileage to the linked persona. Use Patch from CSV
              to apply field,value rows without walking the wizard.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <pre className="whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-900">
            {promptText}
          </pre>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          {copied ? (
            <span className="mr-auto inline-flex items-center gap-1 text-sm font-medium text-emerald-800">
              <Check className="h-4 w-4" aria-hidden />
              Copied to clipboard
            </span>
          ) : (
            <span className="mr-auto text-xs text-gray-500">Copy when ready — text stays here.</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            type="button"
            disabled={copyBusy || !promptText}
            onClick={() => void copy()}
            className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {copyBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardCopy className="h-4 w-4" />
            )}
            {copied ? "Copy again" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

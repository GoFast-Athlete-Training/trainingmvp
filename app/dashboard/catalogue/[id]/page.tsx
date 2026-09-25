"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch } from "@/components/AppProviders";
import {
  CatalogueEditForm,
  type CatalogueFormItem,
} from "@/components/training-manager/CatalogueEditForm";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

function safeReturnTo(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/dashboard/") || raw.startsWith("//")) return null;
  return raw;
}

export default function CatalogueEditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const [id, setId] = useState<string | null>(null);
  const [item, setItem] = useState<CatalogueFormItem | null>(null);

  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await authFetch(`/api/training/catalogue/${id}`);
    const data = (await res.json()) as { item?: CatalogueFormItem };
    setItem(data.item ?? null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!item) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link
        href="/dashboard/catalogue"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Workout catalogue
      </Link>
      <CatalogueEditForm
        initial={item}
        onSaved={async () => {
          if (returnTo) router.push(returnTo);
          else await load();
        }}
        onCancel={() => router.push("/dashboard/catalogue")}
      />
    </div>
  );
}

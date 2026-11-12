export const dynamic = "force-dynamic";

import { prodOnlyCatalogStub } from "@/lib/training/prod-only-catalog-stub";
import { NextRequest } from "next/server";

export async function GET(_request: NextRequest) {
  return prodOnlyCatalogStub("Shakeout run config");
}

export async function POST(_request: NextRequest) {
  return prodOnlyCatalogStub("Shakeout run config");
}

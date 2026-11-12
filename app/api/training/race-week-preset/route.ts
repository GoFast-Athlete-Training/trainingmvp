export const dynamic = "force-dynamic";

import { prodOnlyCatalogStub } from "@/lib/training/prod-only-catalog-stub";
import { NextRequest } from "next/server";

export async function GET(_request: NextRequest) {
  return prodOnlyCatalogStub("Race week presets");
}

export async function POST(_request: NextRequest) {
  return prodOnlyCatalogStub("Race week presets");
}

import type { PlanGoalApi, PlanPersonaApi } from "@/lib/training/plan-entity-serialize";

export function productTrainingBaseUrl(): string {
  const base = process.env.GOFAST_APP_API_URL?.trim();
  if (base) return base.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3001";
  }
  return "";
}

export async function fetchProdPlanPersonas(opts: {
  authorization: string;
  staffId: string;
}): Promise<PlanPersonaApi[]> {
  const url = `${productTrainingBaseUrl()}/api/training/plan-persona?all=1`;
  const res = await fetch(url, {
    headers: {
      Authorization: opts.authorization.startsWith("Bearer ")
        ? opts.authorization
        : `Bearer ${opts.authorization}`,
      "x-gofast-staff-id": opts.staffId,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Prod plan-persona fetch failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { success?: boolean; personas?: PlanPersonaApi[] };
  return json.personas ?? [];
}

export async function fetchProdPlanGoals(opts: {
  authorization: string;
  staffId: string;
}): Promise<PlanGoalApi[]> {
  const url = `${productTrainingBaseUrl()}/api/training/plan-goal?all=1`;
  const res = await fetch(url, {
    headers: {
      Authorization: opts.authorization.startsWith("Bearer ")
        ? opts.authorization
        : `Bearer ${opts.authorization}`,
      "x-gofast-staff-id": opts.staffId,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Prod plan-goal fetch failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { success?: boolean; goals?: PlanGoalApi[] };
  return json.goals ?? [];
}

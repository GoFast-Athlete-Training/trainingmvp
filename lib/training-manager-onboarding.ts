export const ONBOARDED_STORAGE_KEY = "trainingmgmt_onboarded";

export function hasCompletedOnboarding(managerId: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(ONBOARDED_STORAGE_KEY) === managerId;
}

export function markOnboardingComplete(managerId: string): void {
  localStorage.setItem(ONBOARDED_STORAGE_KEY, managerId);
}

export function getPostAuthPath(hasManager: boolean, managerId?: string | null): string {
  if (!hasManager) return "/no-access";
  if (managerId && !hasCompletedOnboarding(managerId)) return "/onboarding";
  return "/dashboard";
}

export function getPostAuthPath(hasManager: boolean): string {
  if (!hasManager) return "/welcome";
  return "/dashboard";
}

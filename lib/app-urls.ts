export function getCompanyAppUrl(): string {
  return (
    process.env.GOFAST_COMPANY_APP_URL?.replace(/\/$/, "") ||
    "https://gofasthq.gofastcrushgoals.com"
  );
}

export function getTrainingManageAppUrl(): string {
  return (
    process.env.GOFAST_TRAINING_MANAGE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_GOFAST_TRAINING_MANAGE_URL?.replace(/\/$/, "") ||
    "http://localhost:3050"
  );
}

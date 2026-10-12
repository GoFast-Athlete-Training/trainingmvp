/**
 * One-off: mirror a TM preset to prod via prodpush (requires TM DATABASE_URL + GOFAST_APP_API_URL + Firebase staff session).
 *
 * Usage (from trainingmvp root, with .env loaded):
 *   PRESET_ID=cmufk2iqs0004lb04c0323te7 STAFF_ID=<training_managers.id> BEARER=<firebase-id-token> npx tsx scripts/push-preset-prod-once.ts
 */
import { pushPresetToProd } from "../lib/training/push-preset-to-prod";

async function main() {
  const presetId = process.env.PRESET_ID?.trim();
  const staffId = process.env.STAFF_ID?.trim();
  const bearer = process.env.BEARER?.trim();
  if (!presetId || !staffId || !bearer) {
    console.error("Set PRESET_ID, STAFF_ID, and BEARER");
    process.exit(1);
  }
  const result = await pushPresetToProd({
    presetId,
    staffId,
    authorization: bearer.startsWith("Bearer ") ? bearer : `Bearer ${bearer}`,
  });
  if (!result.ok) {
    console.error(result.status, result.error);
    process.exit(1);
  }
  console.log("OK", presetId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

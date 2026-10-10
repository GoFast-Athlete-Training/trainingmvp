import admin from "firebase-admin";
import { getAuth, type Auth } from "firebase-admin/auth";

let adminAuthInstance: Auth | null = null;

function unwrapQuoted(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/** Vercel values were pasted with wrapping quotes and literal \\n. */
function normalizePrivateKey(raw: string): string {
  let value = unwrapQuoted(raw);
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === "string") {
      value = parsed;
    } else if (
      parsed &&
      typeof parsed === "object" &&
      "private_key" in parsed &&
      typeof (parsed as { private_key?: unknown }).private_key === "string"
    ) {
      value = (parsed as { private_key: string }).private_key;
    }
  } catch {
    /* PEM or already-unescaped text */
  }
  value = value.replace(/\\n/g, "\n").trim();
  const pem = value.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/);
  return pem ? `${pem[0]}\n` : value;
}

export function getAdminAuth(): Auth {
  if (adminAuthInstance) return adminAuthInstance;

  if (!admin.apps.length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccountKey)),
      });
    } else {
      const projectId =
        process.env.FIREBASE_PROJECT_ID?.trim() ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
      const clientEmail = unwrapQuoted(process.env.FIREBASE_CLIENT_EMAIL ?? "");
      const privateKeyEnv = process.env.FIREBASE_PRIVATE_KEY;
      if (!projectId || !clientEmail || !privateKeyEnv) {
        throw new Error("Firebase Admin env vars missing");
      }
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: normalizePrivateKey(privateKeyEnv),
        }),
      });
    }
  }

  adminAuthInstance = getAuth();
  return adminAuthInstance;
}

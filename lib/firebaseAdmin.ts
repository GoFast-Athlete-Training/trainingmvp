import admin from "firebase-admin";
import { getAuth, type Auth } from "firebase-admin/auth";

let adminAuthInstance: Auth | null = null;

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
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKeyEnv = process.env.FIREBASE_PRIVATE_KEY;
      if (!projectId || !clientEmail || !privateKeyEnv) {
        throw new Error("Firebase Admin env vars missing");
      }
      let privateKey = privateKeyEnv;
      try {
        const parsed = JSON.parse(privateKeyEnv) as { private_key?: string };
        if (parsed.private_key) privateKey = parsed.private_key;
      } catch {
        /* use as-is */
      }
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
      });
    }
  }

  adminAuthInstance = getAuth();
  return adminAuthInstance;
}

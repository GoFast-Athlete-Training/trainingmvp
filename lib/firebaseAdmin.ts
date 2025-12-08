import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";

let app: App | null = null;
let adminAuth: Auth | null = null;

export function initAdmin() {
  if (typeof window !== "undefined") return null;

  if (app && adminAuth) return app;

  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    adminAuth = getAuth(app);
    console.log("✅ Firebase Admin: Using existing app instance");
    return app;
  }

  // Use individual env vars (like GoFastCompany) instead of service account JSON
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error("❌ FIREBASE ADMIN: Missing required env vars");
    console.error("❌ FIREBASE ADMIN: Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY");
    console.error("❌ FIREBASE ADMIN: Present:", {
      projectId: !!projectId,
      clientEmail: !!clientEmail,
      privateKey: !!privateKey,
    });
    return null;
  }

  try {
    // Replace escaped newlines in private key
    const cleanPrivateKey = privateKey.replace(/\\n/g, "\n");

    app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: cleanPrivateKey,
      }),
    });

    adminAuth = getAuth(app);
    console.log("✅ Firebase Admin initialized:", projectId);
    return app;
  } catch (err: any) {
    console.error("❌ FIREBASE ADMIN: Failed to initialize:", err?.message);
    console.error("❌ FIREBASE ADMIN: Error stack:", err?.stack);
    app = null;
    adminAuth = null;
    return null;
  }
}

export function getAdminAuth() {
  if (typeof window !== "undefined") {
    throw new Error("Firebase Admin cannot run client-side");
  }

  if (!adminAuth) {
    const app = initAdmin();
    if (!app || !adminAuth) {
      console.error("❌ FIREBASE ADMIN: Failed to initialize");
      console.error("❌ FIREBASE ADMIN: Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars");
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      console.error("❌ FIREBASE ADMIN: Env vars present:", {
        projectId: !!projectId,
        clientEmail: !!clientEmail,
        privateKey: !!privateKey,
      });
      return null;
    }
  }
  return adminAuth;
}

export async function verifyFirebaseIdToken(token: string) {
  const auth = getAdminAuth();
  if (!auth) {
    console.warn("⚠️ verifyFirebaseIdToken called but Admin not initialized");
    return null;
  }
  return auth.verifyIdToken(token);
}


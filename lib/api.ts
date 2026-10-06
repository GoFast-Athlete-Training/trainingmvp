"use client";

import axios, { type AxiosResponse, type InternalAxiosRequestConfig, type Method } from "axios";
import { auth } from "@/lib/firebase";
import { TRAINING_MANAGER_ID_KEY } from "@/lib/training-manager-session";

const STAFF_ID_HEADER = "x-gofast-staff-id";

type RetriableConfig = InternalAxiosRequestConfig & { _gofastAuthRetried?: boolean };

const SESSION_PROBE_PATHS = ["/api/training-managers/me"];

function requestPath(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost")
      .pathname;
  } catch {
    return url;
  }
}

function isSessionProbe(url: string | undefined): boolean {
  const path = requestPath(url);
  return SESSION_PROBE_PATHS.some((probe) => path === probe || path.startsWith(`${probe}?`));
}

const apiClient = axios.create({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    try {
      if (!auth) return config;
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user) return config;

      try {
        const token = await user.getIdToken(false);
        config.headers.Authorization = `Bearer ${token}`;
      } catch {
        const freshToken = await user.getIdToken(true);
        config.headers.Authorization = `Bearer ${freshToken}`;
      }

      if (typeof window !== "undefined" && !isSessionProbe(config.url)) {
        const staffId = localStorage.getItem(TRAINING_MANAGER_ID_KEY);
        if (staffId) {
          config.headers[STAFF_ID_HEADER] = staffId;
        }
      }
    } catch (error) {
      console.error("API token fetch failed:", error);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

function redirectToWelcome(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("trainingmgmt_staff_id");
  window.location.href = "/welcome";
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const config = error.config as RetriableConfig | undefined;
    const url = config?.url;

    if (!auth) return Promise.reject(error);
    await auth.authStateReady();
    const user = auth.currentUser;

    if (user && config && !config._gofastAuthRetried && isSessionProbe(url)) {
      config._gofastAuthRetried = true;
      try {
        const freshToken = await user.getIdToken(true);
        config.headers.Authorization = `Bearer ${freshToken}`;
        return apiClient.request(config);
      } catch {
        /* fall through */
      }
    }

    if (!user || isSessionProbe(url)) {
      redirectToWelcome();
    }

    return Promise.reject(error);
  },
);

function axiosResponseAsFetch(response: AxiosResponse): Response {
  const data = response.data;
  let body: BodyInit;
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    body = data;
  } else if (data instanceof ArrayBuffer) {
    body = new Blob([data]);
  } else if (typeof data === "string") {
    body = data;
  } else if (data == null) {
    body = "";
  } else {
    body = JSON.stringify(data);
  }
  const headers = new Headers();
  const contentType = response.headers["content-type"];
  if (typeof contentType === "string") headers.set("content-type", contentType);
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

export async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase() as Method;
  const body = init?.body;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const mergedHeaders: Record<string, string> = {};
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => {
      if (isFormData && key.toLowerCase() === "content-type") return;
      mergedHeaders[key] = value;
    });
  }

  const response = await apiClient.request({
    url: path,
    method,
    data: body ?? undefined,
    headers: mergedHeaders,
    ...(isFormData
      ? {
          transformRequest: [
            (data, headers) => {
              if (headers) {
                delete headers["Content-Type"];
                delete headers["content-type"];
              }
              return data;
            },
          ],
        }
      : {}),
    validateStatus: () => true,
  });

  return axiosResponseAsFetch(response);
}

export default {
  get: async (url: string) => {
    const response = await apiClient.get(url);
    return { data: response.data };
  },
  post: async (url: string, data?: unknown) => {
    const response = await apiClient.post(url, data || {});
    return { data: response.data };
  },
  put: async (url: string, data: unknown) => {
    const response = await apiClient.put(url, data);
    return { data: response.data };
  },
  patch: async (url: string, data: unknown) => {
    const response = await apiClient.patch(url, data);
    return { data: response.data };
  },
  delete: async (url: string, data?: unknown) => {
    const response = await apiClient.delete(url, data ? { data } : undefined);
    return { data: response.data };
  },
};

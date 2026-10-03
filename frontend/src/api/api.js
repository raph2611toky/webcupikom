import axios from "axios";
import { env } from "../config/env.js";

let accessToken = null;
let refreshPromise = null;
let unauthorizedHandler = null;

export const api = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === "function" ? handler : null;
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh/", undefined, {
        skipAuthRefresh: true,
        skipAccessToken: true,
      })
      .then(({ data }) => {
        if (!data?.access) {
          throw new Error("Le backend n'a pas retourné de nouvel access token.");
        }
        setAccessToken(data.access);
        return data.access;
      })
      .catch((error) => {
        clearAccessToken();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use((config) => {
  if (accessToken && !config.skipAccessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isUnauthorized = error.response?.status === 401;

    if (
      !isUnauthorized ||
      !original ||
      original._authRetry ||
      original.skipAuthRefresh
    ) {
      return Promise.reject(error);
    }

    original._authRetry = true;

    try {
      await refreshAccessToken();
      return api(original);
    } catch (refreshError) {
      unauthorizedHandler?.();
      return Promise.reject(refreshError);
    }
  },
);

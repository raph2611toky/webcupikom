import { env } from "../config/env.js";

let accessToken = null;
let refreshPromise = null;
let unauthorizedHandler = null;

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

function buildUrl(path, params) {
  const base = `${env.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const url = new URL(base, window.location.origin);

  if (params && typeof params === "object") {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value)) {
        value.forEach((entry) => url.searchParams.append(key, String(entry)));
      } else {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

function httpError(response, data, config) {
  const error = new Error(
    (data && typeof data === "object" && (data.detail || data.message)) ||
    `HTTP ${response.status}`,
  );
  error.response = { status: response.status, data, headers: response.headers };
  error.config = config;
  return error;
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    try { return await response.json(); } catch { return null; }
  }
  const text = await response.text();
  return text || null;
}

async function rawRequest(method, path, body, config = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), env.apiTimeoutMs);
  const headers = new Headers(config.headers || {});
  headers.set("Accept", "application/json");

  if (accessToken && !config.skipAccessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let payload;
  if (body !== undefined && body !== null) {
    if (body instanceof FormData || body instanceof Blob || typeof body === "string") {
      payload = body;
    } else {
      headers.set("Content-Type", "application/json");
      payload = JSON.stringify(body);
    }
  }

  const requestConfig = {
    method,
    headers,
    credentials: "include",
    signal: controller.signal,
    body: method === "GET" || method === "HEAD" ? undefined : payload,
  };

  try {
    const response = await fetch(buildUrl(path, config.params), requestConfig);
    const data = await parseResponse(response);
    if (response.ok) return { data, status: response.status, headers: response.headers };

    const error = httpError(response, data, { ...config, method, path });

    if (
      response.status === 401 &&
      !config.skipAuthRefresh &&
      !config._authRetry
    ) {
      try {
        await refreshAccessToken();
        return await rawRequest(method, path, body, { ...config, _authRetry: true });
      } catch (refreshError) {
        unauthorizedHandler?.();
        throw refreshError;
      }
    }
    throw error;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("La requête a expiré.");
      timeoutError.code = "ECONNABORTED";
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = rawRequest("POST", "/auth/refresh/", undefined, {
      skipAuthRefresh: true,
      skipAccessToken: true,
    })
      .then(({ data }) => {
        if (!data?.access) throw new Error("Le backend n'a pas retourné de nouvel access token.");
        setAccessToken(data.access);
        return data.access;
      })
      .catch((error) => {
        clearAccessToken();
        throw error;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export const api = {
  get(path, config = {}) { return rawRequest("GET", path, undefined, config); },
  post(path, body, config = {}) { return rawRequest("POST", path, body, config); },
  patch(path, body, config = {}) { return rawRequest("PATCH", path, body, config); },
  put(path, body, config = {}) { return rawRequest("PUT", path, body, config); },
  delete(path, config = {}) { return rawRequest("DELETE", path, config.data, config); },
};

const viteEnv = import.meta.env || {};

export const env = Object.freeze({
  apiBaseUrl: (viteEnv.VITE_API_BASE_URL || "https://api.ikomholala.madagascar.webcup.hodi.cloud/api").replace(/\/+$/, ""),
  appUrl: (viteEnv.VITE_APP_URL || "http://localhost:5173").replace(/\/+$/, ""),
  authAfterLogin: viteEnv.VITE_AUTH_AFTER_LOGIN || "/app",
  apiTimeoutMs: Number(viteEnv.VITE_API_TIMEOUT_MS || 15000),
});
const viteEnv = Reflect.get(import.meta, "env") || {};

function requiredEnv(name) {
  const value = typeof viteEnv[name] === "string" ? viteEnv[name].trim() : "";
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = Object.freeze({
  apiBaseUrl: requiredEnv("VITE_API_BASE_URL").replace(/\/+$/, ""),
  appUrl: requiredEnv("VITE_APP_URL").replace(/\/+$/, ""),
  authAfterLogin: typeof viteEnv.VITE_AUTH_AFTER_LOGIN === "string"
    ? viteEnv.VITE_AUTH_AFTER_LOGIN.trim() || "/app"
    : "/app",
  apiTimeoutMs: positiveInteger(viteEnv.VITE_API_TIMEOUT_MS, 15000),
});

function requiredEnv(name) {
  const value = import.meta.env[name]?.trim();
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
  authAfterLogin: import.meta.env.VITE_AUTH_AFTER_LOGIN?.trim() || "/app",
  apiTimeoutMs: positiveInteger(import.meta.env.VITE_API_TIMEOUT_MS, 15000),
});

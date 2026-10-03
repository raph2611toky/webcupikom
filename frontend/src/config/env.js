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
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || "https://api.ikomholala.madagascar.webcup.hodi.cloud/api",
  appUrl: import.meta.VITE_APP_URL?.trim() || "https://ikomholala.madagascar.webcup.hodi.cloud",
  authAfterLogin: import.meta.env.VITE_AUTH_AFTER_LOGIN?.trim() || "/app",
  apiTimeoutMs: positiveInteger(import.meta.env.VITE_API_TIMEOUT_MS, 15000),
});

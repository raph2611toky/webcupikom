import { api, clearAccessToken, setAccessToken } from "./api.js";

const GOOGLE_REMEMBER_KEY = "kamo_google_remember";
let bootstrapPromise = null;

function rememberFromSession() {
  return window.sessionStorage.getItem(GOOGLE_REMEMBER_KEY) !== "false";
}

function consumeGoogleRemember() {
  const remember = rememberFromSession();
  window.sessionStorage.removeItem(GOOGLE_REMEMBER_KEY);
  return remember;
}

export function getApiErrorMessage(error, fallback = "Une erreur est survenue.") {
  const data = error?.response?.data;
  if (!data) return fallback;

  const candidates = [];
  if (typeof data.detail === "string" && data.detail !== "Données invalides.") {
    candidates.push(data.detail);
  }

  const errors = data.errors;
  if (errors && typeof errors === "object") {
    for (const value of Object.values(errors)) {
      if (Array.isArray(value)) candidates.push(...value.map(String));
      else if (typeof value === "string") candidates.push(value);
      else if (value && typeof value === "object") {
        for (const nested of Object.values(value)) {
          if (Array.isArray(nested)) candidates.push(...nested.map(String));
          else if (nested) candidates.push(String(nested));
        }
      }
    }
  }

  return candidates.find(Boolean) || data.detail || fallback;
}

export function isEmailNotVerifiedError(error) {
  const value = error?.response?.data?.errors?.email;
  const text = Array.isArray(value) ? value.join(" ") : String(value || "");
  return text.toLowerCase().includes("non vérifiée");
}

export async function login({ email, password, remember }) {
  const { data } = await api.post(
    "/auth/login/",
    { email, password, remember },
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  setAccessToken(data.access);
  bootstrapPromise = Promise.resolve(data.user);
  return data;
}

export async function register(payload) {
  const { data } = await api.post("/auth/register/", payload, {
    skipAuthRefresh: true,
    skipAccessToken: true,
  });
  return data;
}

export async function startGoogleAuth({ remember = true } = {}) {
  window.sessionStorage.setItem(GOOGLE_REMEMBER_KEY, String(Boolean(remember)));
  const { data } = await api.get("/auth/google/redirect/", {
    skipAuthRefresh: true,
    skipAccessToken: true,
  });
  window.location.assign(data.authorization_url);
}

export async function completeGoogleAuth({ code, state }) {
  const { data } = await api.post(
    "/auth/google/",
    { code, state, remember: consumeGoogleRemember() },
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  setAccessToken(data.access);
  bootstrapPromise = Promise.resolve(data.user);
  return data;
}

export async function verifyEmail({ uid, token }) {
  const { data } = await api.post(
    "/auth/verify-email/",
    { uid, token },
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  setAccessToken(data.access);
  bootstrapPromise = Promise.resolve(data.user);
  return data;
}

export async function resendVerification(email) {
  const { data } = await api.post(
    "/auth/resend-verification/",
    { email },
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  return data;
}

export async function requestPasswordReset(email) {
  const { data } = await api.post(
    "/auth/password-reset/",
    { email },
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  return data;
}

export async function confirmPasswordReset({ uid, token, newPassword, newPasswordConfirm }) {
  const { data } = await api.post(
    "/auth/password-reset/confirm/",
    {
      uid,
      token,
      new_password: newPassword,
      new_password_confirm: newPasswordConfirm,
    },
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  return data;
}

export async function getProfile() {
  const { data } = await api.get("/account/profile/");
  return data;
}

export async function bootstrapSession() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      try {
        const { refreshAccessToken } = await import("./api.js");
        await refreshAccessToken();
        return await getProfile();
      } catch {
        clearAccessToken();
        return null;
      }
    })();
  }
  return bootstrapPromise;
}

export function invalidateSessionBootstrap() {
  bootstrapPromise = null;
}

export async function logout() {
  try {
    await api.post("/auth/logout/", undefined, {
      skipAuthRefresh: true,
      skipAccessToken: true,
    });
  } finally {
    clearAccessToken();
    invalidateSessionBootstrap();
  }
}

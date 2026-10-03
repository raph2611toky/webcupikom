import { getSafeNextPath, navigate, normalizePath } from "../router/navigation.js";

export { getSafeNextPath, navigate, normalizePath };

export const ROLE_HOME = Object.freeze({
  citizen: "/citizen",
  agent: "/agent",
  admin: "/admin",
});

export function roleHome(role) {
  return ROLE_HOME[role] || "/";
}

export function isPathAllowedForRole(pathname, role) {
  const path = normalizePath((pathname || "").split("?")[0]);
  if (!role || !ROLE_HOME[role]) return false;
  if (path === "/app") return true;
  const home = ROLE_HOME[role];
  return path === home || path.startsWith(`${home}/`);
}

export function getRoleSafeNextPath(role, fallback = roleHome(role)) {
  const next = getSafeNextPath("");
  if (next && isPathAllowedForRole(next, role)) return next;
  return fallback;
}

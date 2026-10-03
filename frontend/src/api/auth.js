import { setSession } from "../utils/navigation.js";

export async function login({ email, role = "citizen" }) {
  const name = role === "admin" ? "Admin Terra" : role === "agent" ? "Agent Vega" : "Jennysca";
  const session = { token: `demo-${role}-token`, role, email, name };
  setSession(session);
  return session;
}

export async function register(payload) {
  const session = { token: "demo-citizen-token", role: "citizen", email: payload.email, name: payload.firstName || "Citoyen" };
  setSession(session);
  return session;
}

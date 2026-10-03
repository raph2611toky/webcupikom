import { api } from "./api.js";

export async function getCitizenDashboard() {
  const { data } = await api.get("/citizen/dashboard/");
  return data;
}

export async function getAgentDashboard() {
  const { data } = await api.get("/agent/dashboard/");
  return data;
}

export async function getAdminDashboard() {
  const { data } = await api.get("/admin/dashboard/");
  return data;
}

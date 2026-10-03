import { api } from "./api.js";

export async function getWebcupFeed({ force = false } = {}) {
  const { data } = await api.get("/webcup/requests/", { params: force ? { force: 1 } : undefined });
  return {
    ...data,
    source: data?.meta?.upstream_available === false ? "cache" : "live",
  };
}

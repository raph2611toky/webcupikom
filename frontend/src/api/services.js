import { services } from "../data/services.js";
export async function getServices() { return services; }
export async function getService(slug) { return services.find((item) => item.slug === slug) || null; }

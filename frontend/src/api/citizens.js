import { getAgentRequests } from "./requests.js";

function aggregate(requests) {
  const map = new Map();
  for (const item of requests) {
    const id = item.citizenId;
    if (!id) continue;
    const current = map.get(id) || {
      id,
      name: item.citizen,
      email: item.citizenEmail || "",
      phone: "—",
      district: "—",
      requests: 0,
      status: "Actif",
      requestItems: [],
    };
    current.requests += 1;
    current.requestItems.push(item);
    map.set(id, current);
  }
  return Array.from(map.values());
}

export async function getCitizens() {
  return aggregate(await getAgentRequests());
}

export async function getCitizen(id) {
  const citizens = await getCitizens();
  return citizens.find((citizen) => String(citizen.id) === String(id)) || null;
}

import { webcupRequests } from "../data/mockData.js";

const ENDPOINT = "https://24h.webcup.fr/wp-json/webcup/v1/requests";

export async function getWebcupFeed() {
  const apiKey = import.meta.env.VITE_WEBCUP_API_KEY;
  if (!apiKey) {
    return { source: "mock", session: { status: "running", current_wave: 0, visible_requests_count: 10, next_wave_number: 1, minutes_until_next_wave: 99 }, requests: webcupRequests };
  }

  const response = await fetch(ENDPOINT, { headers: { "X-Webcup-Api-Key": apiKey } });
  if (!response.ok) throw new Error(`Erreur API ${response.status}`);
  const data = await response.json();
  return { source: "live", ...data };
}

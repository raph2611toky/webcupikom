import { api } from "./api.js";

export async function sendContactMessage(payload) {
  const { data } = await api.post("/city/contact/", payload);
  return data;
}

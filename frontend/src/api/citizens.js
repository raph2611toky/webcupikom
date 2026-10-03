import { citizens } from "../data/mockData.js";
export async function getCitizens() { return citizens; }
export async function getCitizen(id) { return citizens.find((citizen) => citizen.id === id) || null; }

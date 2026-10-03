import { news } from "../data/news.js";
export async function getNews() { return news; }
export async function getNewsItem(slug) { return news.find((item) => item.slug === slug) || null; }

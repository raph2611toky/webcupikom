export function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export function formatDateTime(value, options = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: options.withYear ? "numeric" : undefined,
    hour: options.dateOnly ? undefined : "2-digit",
    minute: options.dateOnly ? undefined : "2-digit",
  }).format(date);
}

export function boolParam(value) {
  if (value === undefined || value === null || value === "") return undefined;
  return value ? "true" : "false";
}

const STORAGE_KEY = "nova_terra_data_mode";
const EVENT_NAME = "nova-terra:data-mode";
const SLOW_TYPES = new Set(["slow-2g", "2g", "3g"]);

function connection() {
  if (typeof navigator === "undefined") return null;
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

export function getDataModePreference() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return ["auto", "full", "reduced"].includes(value) ? value : "auto";
  } catch {
    return "auto";
  }
}

export function getConnectionProfile(preference = getDataModePreference()) {
  const info = connection();
  const effectiveType = String(info?.effectiveType || "unknown").toLowerCase();
  const saveData = Boolean(info?.saveData);
  const slowConnection = saveData || SLOW_TYPES.has(effectiveType);
  const reduced = preference === "reduced" || (preference === "auto" && slowConnection);

  return {
    preference,
    mode: reduced ? "reduced" : "full",
    reduced,
    saveData,
    effectiveType,
    downlink: Number(info?.downlink || 0),
    rtt: Number(info?.rtt || 0),
    detectedSlow: slowConnection,
  };
}

export function applyPerformanceMode(preference = getDataModePreference()) {
  const profile = getConnectionProfile(preference);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.dataMode = profile.mode;
    document.documentElement.dataset.connectionType = profile.effectiveType;
    document.documentElement.dataset.saveData = profile.saveData ? "true" : "false";
  }
  return profile;
}

export function setDataModePreference(preference) {
  const safe = ["auto", "full", "reduced"].includes(preference) ? preference : "auto";
  try { localStorage.setItem(STORAGE_KEY, safe); } catch { /* storage optional */ }
  const profile = applyPerformanceMode(safe);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: profile }));
  return profile;
}

export function subscribePerformanceMode(callback) {
  if (typeof window === "undefined") return () => {};
  const info = connection();
  const update = () => callback(applyPerformanceMode());
  const custom = (event) => callback(event.detail || applyPerformanceMode());

  info?.addEventListener?.("change", update);
  window.addEventListener(EVENT_NAME, custom);
  return () => {
    info?.removeEventListener?.("change", update);
    window.removeEventListener(EVENT_NAME, custom);
  };
}

export function isReducedDataMode() {
  return getConnectionProfile().reduced;
}

export function getPerformanceSnapshot() {
  if (typeof performance === "undefined") return { supported: false };
  const resources = performance.getEntriesByType?.("resource") || [];
  const navigation = (performance.getEntriesByType?.("navigation") || [])[0];
  const sum = (rows, key = "transferSize") => rows.reduce((total, row) => total + Number(row?.[key] || 0), 0);
  const images = resources.filter((row) => row.initiatorType === "img");
  const scripts = resources.filter((row) => row.initiatorType === "script");
  const styles = resources.filter((row) => row.initiatorType === "css" || row.initiatorType === "link");
  const transferBytes = sum(resources) + Number(navigation?.transferSize || 0);
  const encodedBytes = sum(resources, "encodedBodySize") + Number(navigation?.encodedBodySize || 0);
  return {
    supported: true,
    measuredAt: new Date().toISOString(),
    resourceCount: resources.length,
    transferBytes,
    encodedBytes,
    transferKb: Math.round(transferBytes / 1024),
    encodedKb: Math.round(encodedBytes / 1024),
    imageCount: images.length,
    imageTransferKb: Math.round(sum(images) / 1024),
    scriptCount: scripts.length,
    scriptTransferKb: Math.round(sum(scripts) / 1024),
    styleCount: styles.length,
    styleTransferKb: Math.round(sum(styles) / 1024),
    domImages: typeof document !== "undefined" ? document.images.length : 0,
  };
}

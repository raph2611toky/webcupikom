const STORAGE_KEY = "nova_terra_accessibility";

export const DEFAULT_ACCESSIBILITY = {
  fontSize: "normal",
  contrast: "normal",
  characterSpacing: "normal",
};

export function loadAccessibilityPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      fontSize: ["normal", "large", "xlarge"].includes(saved.fontSize) ? saved.fontSize : "normal",
      contrast: saved.contrast === "high" ? "high" : "normal",
      characterSpacing: ["normal", "wide", "xwide"].includes(saved.characterSpacing) ? saved.characterSpacing : "normal",
    };
  } catch {
    return { ...DEFAULT_ACCESSIBILITY };
  }
}

export function applyAccessibilityPreferences(preferences) {
  const root = document.documentElement;
  root.dataset.fontSize = preferences.fontSize || "normal";
  root.dataset.contrast = preferences.contrast || "normal";
  root.dataset.characterSpacing = preferences.characterSpacing || "normal";
}

export function saveAccessibilityPreferences(preferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  applyAccessibilityPreferences(preferences);
  window.dispatchEvent(new CustomEvent("nova-accessibility-change", { detail: preferences }));
}

export function resetAccessibilityPreferences() {
  const next = { ...DEFAULT_ACCESSIBILITY };
  saveAccessibilityPreferences(next);
  return next;
}

import { navigate } from "./navigation.js";

export function navigateAuth(to) {
  const go = () => navigate(to);

  if (
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    document.startViewTransition(go);
    return;
  }

  go();
}

import { useEffect, useState } from "react";
import { applyPerformanceMode, subscribePerformanceMode } from "./performance.js";

export function useDataMode() {
  const [profile, setProfile] = useState(() => applyPerformanceMode());
  useEffect(() => subscribePerformanceMode(setProfile), []);
  return profile;
}

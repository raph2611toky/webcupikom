import { useEffect, useRef } from "react";

export default function useRealtimeRefresh(eventNames, callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const names = Array.isArray(eventNames) ? eventNames : [eventNames];
    const handler = (event) => callbackRef.current?.(event);
    names.filter(Boolean).forEach((name) => window.addEventListener(name, handler));
    return () => names.filter(Boolean).forEach((name) => window.removeEventListener(name, handler));
  }, [Array.isArray(eventNames) ? eventNames.join("|") : eventNames]);
}

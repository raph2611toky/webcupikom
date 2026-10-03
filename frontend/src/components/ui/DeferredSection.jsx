import { useEffect, useRef, useState } from "react";

export default function DeferredSection({ children, minHeight = 320, rootMargin = "500px 0px", label = "Chargement différé" }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return undefined;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setReady(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setReady(true);
        observer.disconnect();
      }
    }, { rootMargin });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ready, rootMargin]);

  return <div ref={ref} className="deferred-section" style={{ minHeight: ready ? undefined : minHeight }} aria-busy={!ready} aria-label={!ready ? label : undefined}>
    {ready ? children : <div className="deferred-section__placeholder" aria-hidden="true" />}
  </div>;
}

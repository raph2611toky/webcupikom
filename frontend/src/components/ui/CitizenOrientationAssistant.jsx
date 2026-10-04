import { useEffect, useState } from "react";
import { getAssistantCapabilities, orientCitizenNeed } from "../../api/assistant.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import { useLocale } from "../../utils/i18n.js";
import "../../styles/pages/citizen-assistant.css";

const COPY = {
  fr: {
    label: "ORIENTATION RAPIDE",
    title: "De quoi avez-vous besoin ?",
    intro: "Décrivez votre besoin en une phrase. Nova Terra vous oriente vers le bon service ou le bon signalement.",
    placeholder: "Ex. Un lampadaire est cassé devant mon immeuble…",
    submit: "M’orienter",
    loading: "Recherche…",
    local: "Orientation locale",
    backend: "Assistant connecté",
    confidence: "Confiance",
    emergency: "Prioritaire",
    error: "Impossible d’obtenir une orientation pour le moment.",
  },
  en: {
    label: "QUICK GUIDANCE",
    title: "What do you need?",
    intro: "Describe your need in one sentence. Nova Terra will point you to the right service or report form.",
    placeholder: "E.g. A street light is broken outside my building…",
    submit: "Guide me",
    loading: "Searching…",
    local: "Local guidance",
    backend: "Connected assistant",
    confidence: "Confidence",
    emergency: "Priority",
    error: "Guidance is temporarily unavailable.",
  },
  mg: {
    label: "TORO-LALANA HAINGANA",
    title: "Inona no ilainao?",
    intro: "Farito amin’ny fehezanteny iray ny filànao. Nova Terra dia hitondra anao amin’ny sampan-draharaha na tatitra mety.",
    placeholder: "Ohatra: simba ny jiro eny an-dalana eo akaikin'ny tranoko…",
    submit: "Tariho aho",
    loading: "Mikaroka…",
    local: "Toro-lalana eo an-toerana",
    backend: "Mpanampy mifandray",
    confidence: "Fahatokisana",
    emergency: "Laharam-pahamehana",
    error: "Tsy afaka manome toro-lalana amin’izao fotoana izao.",
  },
};

export default function CitizenOrientationAssistant({ compact = false, initialValue = "" }) {
  const [locale] = useLocale();
  const copy = COPY[locale] || COPY.fr;
  const [query, setQuery] = useState(initialValue);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [backendAvailable, setBackendAvailable] = useState(null);

  useEffect(() => {
    let active = true;
    getAssistantCapabilities()
      .then((capabilities) => active && setBackendAvailable(capabilities?.source === "backend" || capabilities?.available === true))
      .catch(() => active && setBackendAvailable(false));
    return () => { active = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const orientation = await orientCitizenNeed(value, { locale });
      setResult(orientation);
      if (orientation.source === "backend") setBackendAvailable(true);
      if (orientation.source === "fallback") setBackendAvailable(false);
    } catch (err) {
      setError(getApiErrorMessage(err, copy.error));
    } finally {
      setLoading(false);
    }
  }

  const confidence = result?.confidence == null ? null : Math.round(result.confidence * 100);

  return (
    <section className={`citizen-assistant${compact ? " is-compact" : ""}${result?.emergency ? " is-emergency" : ""}`} aria-label={copy.title}>
      <div className="citizen-assistant__intro">
        <span>{copy.label}</span>
        <div><h3>{copy.title}</h3><p>{copy.intro}</p></div>
        <small className={backendAvailable === true ? "is-online" : ""}>{backendAvailable === true ? copy.backend : copy.local}</small>
      </div>
      <form className="citizen-assistant__form" onSubmit={submit}>
        <label>
          <span className="sr-only">{copy.title}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.placeholder} maxLength={500} />
        </label>
        <button type="submit" disabled={loading || !query.trim()}>{loading ? copy.loading : copy.submit}<i aria-hidden="true">→</i></button>
      </form>
      {error ? <div className="citizen-assistant__error" role="alert">{error}</div> : null}
      {result ? <div className="citizen-assistant__result" aria-live="polite">
        <div className="citizen-assistant__result-copy">
          <div className="citizen-assistant__badges">
            {result.emergency ? <span className="is-emergency">! {copy.emergency}</span> : null}
            {confidence !== null ? <span>{copy.confidence} {confidence}%</span> : null}
            {result.fallback ? <span>{copy.local}</span> : null}
          </div>
          <strong>{result.title}</strong>
          <p>{result.answer}</p>
        </div>
        <div className="citizen-assistant__result-actions">
          <button type="button" className="citizen-assistant__primary-action" onClick={() => navigate(result.path)}>{result.actionLabel}<span aria-hidden="true">→</span></button>
          {Array.isArray(result.suggestions) && result.suggestions.length ? <div className="citizen-assistant__suggestions" aria-label="Suggestions">
            {result.suggestions.slice(0,4).map((suggestion,index) => {
              const item = typeof suggestion === "string" ? { label: suggestion } : suggestion || {};
              const label = item.label || item.title || item.text;
              if (!label) return null;
              return <button type="button" key={`${label}-${index}`} onClick={() => item.path ? navigate(item.path) : setQuery(item.message || label)}>{label}</button>;
            })}
          </div> : null}
        </div>
      </div> : null}
    </section>
  );
}

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getCityTransport, getTransportStop, getTransportStops } from "../../api/transport.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useLocale } from "../../utils/i18n.js";
import "../../styles/service-availability.css";

const NovaTerraMap = lazy(() => import("../../components/NovaTerraMap/NovaTerraMap.jsx"));

const COPY = {
  fr: {
    title:"Transport",
    eyebrow:"Espace citoyen",
    subtitle:"Lignes, arrêts, horaires et informations pratiques de Nova Terra.",
    allDistricts:"Tous les quartiers",
    allLines:"Toutes les lignes",
    nearby:"Autour de moi",
    citywide:"Toute la ville",
    stops:"Arrêts",
    lines:"Lignes",
    near:"À proximité",
    timetable:"Horaires de circulation",
    practical:"Infos pratiques",
    distance:"Distance",
    address:"Adresse",
    district:"Quartier",
    close:"Fermer",
    locateError:"Impossible d’utiliser votre position. Vous pouvez toujours consulter tous les arrêts de la ville.",
    loading:"Chargement du transport…",
    mapLoading:"Chargement de la carte 2D…",
    available:"Transport disponible",
    unavailable:"Transport temporairement indisponible",
    availableHint:"Consultez les passages et les lignes disponibles pour cet arrêt.",
    unavailableHint:"Cet arrêt est momentanément indisponible. Consultez les informations pratiques avant votre déplacement.",
    noSchedule:"Horaires non communiqués",
    updated:"Disponibilité de l’arrêt",
  },
  en: {
    title:"Transport",
    eyebrow:"Citizen space",
    subtitle:"Lines, stops, schedules and practical information for Nova Terra.",
    allDistricts:"All districts",
    allLines:"All lines",
    nearby:"Near me",
    citywide:"Whole city",
    stops:"Stops",
    lines:"Lines",
    near:"Nearby",
    timetable:"Service hours",
    practical:"Practical info",
    distance:"Distance",
    address:"Address",
    district:"District",
    close:"Close",
    locateError:"Your location could not be used. You can still browse all city stops.",
    loading:"Loading transport…",
    mapLoading:"Loading 2D map…",
    available:"Transport available",
    unavailable:"Transport temporarily unavailable",
    availableHint:"Check the available passages and lines for this stop.",
    unavailableHint:"This stop is temporarily unavailable. Check practical information before travelling.",
    noSchedule:"No schedule provided",
    updated:"Stop availability",
  },
  mg: {
    title:"Fitaterana",
    eyebrow:"Sehatra olom-pirenena",
    subtitle:"Lalana, fijanonana, ora ary vaovao ilaina eto Nova Terra.",
    allDistricts:"Faritra rehetra",
    allLines:"Lalana rehetra",
    nearby:"Akaiky ahy",
    citywide:"Tanàna manontolo",
    stops:"Fijanonana",
    lines:"Lalana",
    near:"Akaiky",
    timetable:"Ora fivezivezena",
    practical:"Vaovao ilaina",
    distance:"Elanelana",
    address:"Adiresy",
    district:"Faritra",
    close:"Hidio",
    locateError:"Tsy afaka nampiasa ny toerana misy anao. Afaka mijery ny fijanonana rehetra ianao.",
    loading:"Mamaky fitaterana…",
    mapLoading:"Mamaky ny sarintany 2D…",
    available:"Misy fitaterana",
    unavailable:"Tsy misy fitaterana vetivety",
    availableHint:"Jereo ny ora sy ny zotra misy amin’ity fijanonana ity.",
    unavailableHint:"Tsy misy ity fijanonana ity vetivety. Jereo ny vaovao ilaina alohan’ny handehanana.",
    noSchedule:"Tsy mbola misy ora",
    updated:"Fisian’ny fijanonana",
  },
};

function lineName(line) {
  return line?.name || line?.label || line?.id || String(line || "");
}

function lineKey(line) {
  return String(line?.id ?? line?.name ?? line);
}

function humanKey(value = "") {
  const raw = String(value || "").replace(/[_-]+/g, " ").trim();
  if (!raw) return "Information";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatClock(value, locale = "fr") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(
    locale === "en" ? "en-GB" : "fr-FR",
    { hour:"2-digit", minute:"2-digit" },
  ).format(date);
}

function formatStructuredValue(value, locale = "fr", depth = 0) {
  if (value == null || value === "") return "—";

  if (typeof value === "boolean") {
    return locale === "en"
      ? (value ? "Yes" : "No")
      : locale === "mg"
        ? (value ? "Eny" : "Tsia")
        : (value ? "Oui" : "Non");
  }

  if (["string", "number", "bigint"].includes(typeof value)) {
    const text = String(value);
    return text === "[object Object]" ? "—" : text;
  }

  if (Array.isArray(value)) {
    if (!value.length) return "—";
    return value
      .map((entry) => formatStructuredValue(entry, locale, depth + 1))
      .filter(Boolean)
      .join(" · ");
  }

  if (typeof value === "object") {
    const start =
      value.starts_at ?? value.start_at ?? value.start ?? value.from ?? value.departure;
    const end =
      value.ends_at ?? value.end_at ?? value.end ?? value.to ?? value.arrival;

    if (start || end) {
      const startText = start ? formatClock(start, locale) : "";
      const endText = end ? formatClock(end, locale) : "";
      const timeRange = startText && endText
        ? `${startText} → ${endText}`
        : startText || endText;

      const extras = [];
      const duration = value.duration_minutes ?? value.duration;
      const frequency = value.frequency_minutes ?? value.frequency;
      if (duration) extras.push(`${duration} min`);
      if (frequency) extras.push(locale === "en" ? `every ${frequency} min` : `toutes les ${frequency} min`);

      return [timeRange, ...extras].filter(Boolean).join(" · ") || "—";
    }

    const entries = Object.entries(value).filter(
      ([key]) => !["timezone", "tz"].includes(key),
    );
    if (!entries.length) return "—";

    return entries
      .map(([key, entry]) => {
        const rendered = formatStructuredValue(entry, locale, depth + 1);
        return depth > 1 ? rendered : `${humanKey(key)} : ${rendered}`;
      })
      .join(" · ");
  }

  return String(value);
}

function structuredRows(value) {
  if (value == null || value === "") return [];

  if (Array.isArray(value)) {
    return value.map((entry, index) => {
      if (
        entry &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        Object.prototype.hasOwnProperty.call(entry, "key")
      ) {
        return [entry.key || `Passage ${index + 1}`, entry.value];
      }

      return [`Passage ${index + 1}`, entry];
    });
  }

  if (typeof value === "object") return Object.entries(value);
  return [["Information", value]];
}

function TransportSchedule({ stop, copy, locale }) {
  const available = stop?.isActive !== false;
  const timetableRows = structuredRows(stop?.timetable);
  const rows = timetableRows.length
    ? timetableRows
    : stop?.openingHours
      ? [["Disponibilité", stop.openingHours]]
      : [];

  return (
    <section
      className={`service-availability-notice tr87-schedule-notice ${available ? "is-available" : "is-unavailable"}`}
      aria-label={copy.timetable}
    >
      <div className="service-availability-notice__icon" aria-hidden="true">
        {available ? "◷" : "!"}
      </div>

      <div className="service-availability-notice__copy">
        <div className="service-availability-notice__head">
          <strong>{available ? copy.available : copy.unavailable}</strong>
          <small>{copy.updated}</small>
        </div>

        <p>{available ? copy.availableHint : copy.unavailableHint}</p>

        <div className="tr87-schedule-grid">
          {rows.length ? rows.map(([key, value], index) => (
            <div key={`${key}-${index}`}>
              <span>{humanKey(key)}</span>
              <b>{formatStructuredValue(value, locale)}</b>
            </div>
          )) : (
            <div>
              <span>{copy.timetable}</span>
              <b>{copy.noSchedule}</b>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function CitizenTransport() {
  const [locale] = useLocale();
  const copy = COPY[locale] || COPY.fr;
  const [overview, setOverview] = useState({ lines:[], stops:[] });
  const [stops, setStops] = useState([]);
  const [district, setDistrict] = useState("");
  const [line, setLine] = useState("");
  const [mode, setMode] = useState("city");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCity() {
    setLoading(true);
    setError("");

    try {
      const [transport, stopRows] = await Promise.all([
        getCityTransport({ district:district || undefined, line:line || undefined }),
        getTransportStops({ district:district || undefined }),
      ]);

      setOverview(transport);
      setStops(stopRows.length ? stopRows : transport.stops);
      setMode("city");
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de charger le transport."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCity();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (mode === "city") loadCity();
    }, 220);

    return () => window.clearTimeout(timer);
  }, [district, line]);

  const allLines = useMemo(() => {
    const map = new Map();

    [...overview.lines, ...stops.flatMap((stop) => stop.lines || [])].forEach((item) => {
      map.set(lineKey(item), item);
    });

    return [...map.values()];
  }, [overview.lines, stops]);

  const districts = useMemo(
    () => [...new Set(stops.map((stop) => stop.district).filter(Boolean))].sort(),
    [stops],
  );

  const visibleStops = useMemo(() => {
    if (!line) return stops;

    return stops.filter((stop) =>
      (stop.lines || []).some((item) => lineKey(item) === line),
    );
  }, [stops, line]);

  async function nearMe() {
    if (!navigator.geolocation) {
      setError(copy.locateError);
      return;
    }

    setLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const rows = await getTransportStops({
            lat:position.coords.latitude,
            lon:position.coords.longitude,
            radiusKm:15,
          });
          setStops(rows);
          setMode("near");
        } catch (err) {
          setError(getApiErrorMessage(err, copy.locateError));
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError(copy.locateError);
        setLoading(false);
      },
      { enableHighAccuracy:false, timeout:8000, maximumAge:120000 },
    );
  }

  async function openStop(stop) {
    if (!stop) return;

    try {
      setSelected(await getTransportStop(stop.slug));
    } catch {
      setSelected(stop);
    }
  }

  return (
    <div className="portal-layout">
      <CitizenSidebar />

      <div className="portal-main">
        <PortalTopbar eyebrow={copy.eyebrow} title={copy.title} />

        <main className="portal-content tr87-page">
          <header className="tr87-heading">
            <div>
              <p>{copy.subtitle}</p>
            </div>

            <div className="tr87-actions">
              <button
                type="button"
                className={mode === "city" ? "is-active" : ""}
                onClick={loadCity}
              >
                ▦ {copy.citywide}
              </button>
              <button
                type="button"
                className={mode === "near" ? "is-active" : ""}
                onClick={nearMe}
              >
                ⌖ {copy.nearby}
              </button>
            </div>
          </header>

          {error ? <div className="error-card" role="alert">{error}</div> : null}

          <section className="tr87-toolbar tr87-toolbar--map">
            <select value={district} onChange={(event) => setDistrict(event.target.value)}>
              <option value="">{copy.allDistricts}</option>
              {districts.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <select value={line} onChange={(event) => setLine(event.target.value)}>
              <option value="">{copy.allLines}</option>
              {allLines.map((item) => (
                <option key={lineKey(item)} value={lineKey(item)}>{lineName(item)}</option>
              ))}
            </select>
          </section>

          <section className="tr87-summary">
            <article>
              <span>◉</span>
              <div><b>{visibleStops.length}</b><small>{copy.stops}</small></div>
            </article>
            <article>
              <span>⇄</span>
              <div><b>{allLines.length}</b><small>{copy.lines}</small></div>
            </article>
            <article>
              <span>⌖</span>
              <div>
                <b>{visibleStops.filter((stop) => stop.distanceKm != null).length}</b>
                <small>{copy.near}</small>
              </div>
            </article>
          </section>

          {loading ? (
            <div className="tr87-empty" role="status">{copy.loading}</div>
          ) : (
            <Suspense fallback={<div className="tr87-empty">{copy.mapLoading}</div>}>
              <NovaTerraMap
                mode="transport"
                transportStops={visibleStops}
                locale={locale}
                onTransportOpen={openStop}
              />
            </Suspense>
          )}
        </main>

        {selected ? (
          <div
            className="tr87-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelected(null);
            }}
          >
            <section
              className="tr87-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="transport-stop-title"
            >
              <button
                className="tr87-close"
                type="button"
                aria-label={copy.close}
                onClick={() => setSelected(null)}
              >
                ×
              </button>

              <span className="section-label">{selected.kindLabel}</span>
              <h2 id="transport-stop-title">{selected.name}</h2>
              <p>{selected.description}</p>

              <div className="tr87-detail-grid">
                <div><span>{copy.address}</span><b>{selected.address || "—"}</b></div>
                <div><span>{copy.district}</span><b>{selected.district || "—"}</b></div>
                <div>
                  <span>{copy.lines}</span>
                  <b>{(selected.lines || []).map(lineName).join(", ") || "—"}</b>
                </div>
                <div>
                  <span>{copy.distance}</span>
                  <b>{selected.distanceKm != null ? `${selected.distanceKm.toFixed(2)} km` : "—"}</b>
                </div>
              </div>

              <TransportSchedule stop={selected} copy={copy} locale={locale} />

              <div className="tr87-json-block tr87-practical-block">
                <strong>{copy.practical}</strong>
                {structuredRows(selected.practicalInfo).length ? (
                  structuredRows(selected.practicalInfo).map(([key, value], index) => (
                    <div key={`${key}-${index}`}>
                      <span>{humanKey(key)}</span>
                      <b>{formatStructuredValue(value, locale)}</b>
                    </div>
                  ))
                ) : (
                  <p>—</p>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

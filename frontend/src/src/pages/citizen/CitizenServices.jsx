import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getServices } from "../../api/services.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import { useDataMode } from "../../utils/useDataMode.js";
import cityArt from "../../assets/services/city.webp";
import adminArt from "../../assets/services/administration.webp";
import energyArt from "../../assets/services/energy.webp";
import healthArt from "../../assets/services/health.webp";
import housingArt from "../../assets/services/housing.webp";
import safetyArt from "../../assets/services/safety.webp";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";
import "../../styles/pages/citizen-services-v84.css";

const NovaTerraMap = lazy(() => import("../../components/NovaTerraMap/NovaTerraMap.jsx"));

const COPY = {
  fr: {
    eyebrow: "Espace citoyen",
    title: "Services municipaux",
    kicker: "SERVICES DE LA VILLE",
    hero: "Votre ville, vos services",
    intro: "Accédez rapidement à tous les services municipaux et vérifiez leur disponibilité avant de commencer une démarche.",
    search: "Rechercher un service (ex. déchets, eau, permis...)",
    all: "Tous",
    cards: "Cartes",
    map: "Carte 2D",
    available: "Disponibles",
    limited: "Limités",
    unavailable: "Indisponibles",
    open: "Voir le service",
    alternative: "Alternative",
    result: "service",
    results: "services",
    empty: "Aucun service ne correspond à vos filtres.",
    reset: "Réinitialiser",
    saver: "Mode économie de données actif : les illustrations sont masquées.",
  },
  en: {
    eyebrow: "Citizen space",
    title: "City services",
    kicker: "CITY SERVICES",
    hero: "Your city, your services",
    intro: "Access all municipal services quickly and check their availability before starting a procedure.",
    search: "Search for a service (e.g. waste, water, permit...)",
    all: "All",
    cards: "Cards",
    map: "2D map",
    available: "Available",
    limited: "Limited",
    unavailable: "Unavailable",
    open: "View service",
    alternative: "Alternative",
    result: "service",
    results: "services",
    empty: "No service matches your filters.",
    reset: "Reset",
    saver: "Data saver mode is active: illustrations are hidden.",
  },
  mg: {
    eyebrow: "Sehatra olom-pirenena",
    title: "Sampan-draharahan'ny tanàna",
    kicker: "SAMPAN-DRAHARAHAN'NY TANÀNA",
    hero: "Ny tanànanao, ny sampan-draharahanao",
    intro: "Jereo haingana ireo sampan-draharaha rehetra sy ny fahafahany miasa alohan'ny hanombohanao dingana iray.",
    search: "Hitady sampan-draharaha",
    all: "Rehetra",
    cards: "Karatra",
    map: "Sarintany 2D",
    available: "Misy",
    limited: "Voafetra",
    unavailable: "Tsy misy",
    open: "Hijery ny sampan-draharaha",
    alternative: "Safidy hafa",
    result: "sampan-draharaha",
    results: "sampan-draharaha",
    empty: "Tsy misy sampan-draharaha mifanaraka amin'ny sivana.",
    reset: "Averina",
    saver: "Maody mitsitsy data : tsy aseho ny sary haingo.",
  },
};

const VISUALS = {
  administration: { tone: "lavender", art: adminArt, symbol: "▥" },
  energy: { tone: "amber", art: energyArt, symbol: "ϟ" },
  health: { tone: "blue", art: healthArt, symbol: "+" },
  housing: { tone: "green", art: housingArt, symbol: "⌂" },
  safety: { tone: "red", art: safetyArt, symbol: "◇" },
  transport: { tone: "indigo", art: cityArt, symbol: "↔" },
  default: { tone: "lavender", art: cityArt, symbol: "◇" },
};

function plain(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function visualFor(service) {
  const text = plain(`${service?.slug || ""} ${service?.name || ""} ${service?.category || ""}`);
  if (/admin|civil|etat/.test(text)) return VISUALS.administration;
  if (/energ|electric/.test(text)) return VISUALS.energy;
  if (/sante|health|medical/.test(text)) return VISUALS.health;
  if (/habitat|housing|logement|residence/.test(text)) return VISUALS.housing;
  if (/secur|safety|security/.test(text)) return VISUALS.safety;
  if (/transport|mobilit/.test(text)) return VISUALS.transport;
  return VISUALS.default;
}

function availabilityFor(service) {
  if (service?.isAvailable === false) return "unavailable";
  const text = plain(`${service?.availabilityLabel || ""} ${service?.unavailabilityReason || ""}`);
  if (/limit|reduit|partiel|partial/.test(text)) return "limited";
  return "available";
}

export default function CitizenServices() {
  const [locale] = useLocale();
  const profile = useDataMode();
  const copy = COPY[locale] || COPY.fr;
  const [services, setServices] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [view, setView] = useState(() => localStorage.getItem("nova_terra_services_view") || "cards");

  useEffect(() => {
    let active = true;
    const refresh = () => getServices({ force: true }).then((rows) => active && setServices(rows)).catch(() => {});
    getServices().then((rows) => active && setServices(rows)).catch(() => active && setServices([]));
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [locale]);

  useEffect(() => {
    if (profile.reduced && view === "map") setView("cards");
  }, [profile.reduced]);

  const rows = useMemo(() => services.map((service) => ({
    ...service,
    visual: visualFor(service),
    availabilityState: availabilityFor(service),
  })), [services]);

  const categories = useMemo(() => Array.from(new Set(rows.map((item) => item.category).filter(Boolean))), [rows]);
  const counts = useMemo(() => ({
    all: rows.length,
    available: rows.filter((item) => item.availabilityState === "available").length,
    limited: rows.filter((item) => item.availabilityState === "limited").length,
    unavailable: rows.filter((item) => item.availabilityState === "unavailable").length,
  }), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((service) => {
      if (category !== "all" && service.category !== category) return false;
      if (availability !== "all" && service.availabilityState !== availability) return false;
      if (!q) return true;
      return `${service.name} ${service.category} ${service.shortDescription || ""} ${service.description || ""} ${service.unavailabilityReason || ""}`.toLowerCase().includes(q);
    });
  }, [rows, query, category, availability]);

  const visibleSlugs = useMemo(() => new Set(filtered.map((item) => item.slug)), [filtered]);

  function setDisplay(next) {
    if (profile.reduced && next === "map") return;
    setView(next);
    localStorage.setItem("nova_terra_services_view", next);
  }

  return (
    <div className="portal-layout">
      <CitizenSidebar />
      <div className="portal-main">
        <PortalTopbar eyebrow={copy.eyebrow} title={copy.title} />
        <main className="portal-content svc84-page">
          <section className="svc84-hero">
            <div className="svc84-hero__copy">
              <span>{copy.kicker}</span>
              <h2>{copy.hero}</h2>
              <p>{copy.intro}</p>
              {profile.reduced ? <small>{copy.saver}</small> : null}
            </div>
            {!profile.reduced ? <img className="svc84-hero__art" src={cityArt} alt="" aria-hidden="true" decoding="async" /> : null}
          </section>

          <section className="svc84-toolbar" aria-label="Recherche et filtres des services">
            <label className="svc84-search">
              <span aria-hidden="true">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} aria-label={copy.search} />
            </label>

            <div className="svc84-categories" role="group" aria-label="Catégories">
              <button type="button" className={category === "all" ? "is-active" : ""} onClick={() => setCategory("all")}>{copy.all}</button>
              {categories.map((item) => (
                <button type="button" key={item} className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>{item}</button>
              ))}
            </div>

            <div className="svc84-view" role="group" aria-label="Mode d'affichage">
              <button type="button" className={view === "cards" ? "is-active" : ""} onClick={() => setDisplay("cards")}>▦ {copy.cards}</button>
              <button type="button" className={view === "map" ? "is-active" : ""} onClick={() => setDisplay("map")} disabled={profile.reduced}>◇ {copy.map}</button>
            </div>
          </section>

          <section className="svc84-summary" aria-live="polite">
            <strong>{filtered.length} {filtered.length > 1 ? copy.results : copy.result}</strong>
            <div className="svc84-status-filters" role="group" aria-label="Disponibilité">
              <button type="button" aria-pressed={availability === "available"} className={availability === "available" ? "is-active" : ""} onClick={() => setAvailability((current) => current === "available" ? "all" : "available")}><i className="available" />{copy.available}</button>
              <button type="button" aria-pressed={availability === "limited"} className={availability === "limited" ? "is-active" : ""} onClick={() => setAvailability((current) => current === "limited" ? "all" : "limited")}><i className="limited" />{copy.limited}</button>
              <button type="button" aria-pressed={availability === "unavailable"} className={availability === "unavailable" ? "is-active" : ""} onClick={() => setAvailability((current) => current === "unavailable" ? "all" : "unavailable")}><i className="unavailable" />{copy.unavailable}</button>
            </div>
          </section>

          {view === "map" ? (
            <Suspense fallback={<div className="svc84-empty">Chargement de la carte 2D…</div>}>
              <NovaTerraMap services={rows} visibleSlugs={visibleSlugs} locale={locale} />
            </Suspense>
          ) : filtered.length ? (
            <section className="svc84-grid">
              {filtered.map((service) => (
                <article key={service.slug} className={`svc84-card tone-${service.visual.tone} state-${service.availabilityState}`}>
                  <div className="svc84-card__body">
                    <div className="svc84-card__head">
                      <span className="svc84-card__icon" aria-hidden="true">{service.visual.symbol}</span>
                      <div>
                        <span className="svc84-card__category">{service.category}</span>
                        <h3>{service.name}</h3>
                      </div>
                      <span className={`svc84-badge is-${service.availabilityState}`}>
                        <i />
                        {service.availabilityState === "unavailable" ? copy.unavailable : service.availabilityState === "limited" ? copy.limited : copy.available}
                      </span>
                    </div>
                    <p>{service.isAvailable === false ? (service.unavailabilityReason || service.shortDescription) : service.shortDescription}</p>
                    {service.isAvailable === false && service.alternativeAction ? <small><b>{copy.alternative} :</b> {service.alternativeAction}</small> : null}
                    <button type="button" className="svc84-card__cta" onClick={() => navigate(/transport|mobilit/.test(plain(`${service.slug || ""} ${service.name || ""} ${service.category || ""}`)) ? "/citizen/transport" : `/citizen/services/${service.slug}`)}>{copy.open}<span>→</span></button>
                  </div>
                  {!profile.reduced && service.visual.art ? <img className="svc84-card__art" src={service.visual.art} alt="" aria-hidden="true" loading="lazy" decoding="async" /> : null}
                </article>
              ))}
            </section>
          ) : (
            <div className="svc84-empty"><span>⌕</span><strong>{copy.empty}</strong></div>
          )}
        </main>
      </div>
    </div>
  );
}

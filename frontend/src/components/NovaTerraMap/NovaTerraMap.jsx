import { useEffect, useMemo, useRef, useState } from "react";
import { getCitizenRequests } from "../../api/requests.js";
import { getAlerts } from "../../api/news.js";
import { navigate } from "../../utils/navigation.js";
import {
  CITY_DISTRICTS,
  CITY_POIS,
  buildServiceLocations,
  buildTransportLocations,
  projectAlert,
  projectReport,
  projectReportAlert,
} from "./locations.js";
import "./NovaTerraMap.css";

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 680;

const GEO_BOUNDS = {
  north: 45.82,
  south: 45.72,
  west: 4.76,
  east: 4.96,
};

const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

let mapLibrePromise = null;

function loadMapLibre() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Browser only"));
  }

  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (mapLibrePromise) return mapLibrePromise;

  mapLibrePromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-nova-maplibre="css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css";
      link.dataset.novaMaplibre = "css";
      document.head.appendChild(link);
    }

    const existing = document.querySelector('script[data-nova-maplibre="js"]');
    if (existing) {
      if (window.maplibregl) {
        resolve(window.maplibregl);
        return;
      }
      existing.addEventListener("load", () => resolve(window.maplibregl), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js";
    script.async = true;
    script.dataset.novaMaplibre = "js";
    script.onload = () => (
      window.maplibregl
        ? resolve(window.maplibregl)
        : reject(new Error("MapLibre unavailable"))
    );
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return mapLibrePromise;
}

async function loadNovaBaseStyle() {
  const response = await fetch(OPENFREEMAP_STYLE);
  if (!response.ok) throw new Error("OpenFreeMap style unavailable");

  const style = await response.json();

  /*
   * Nova Terra est fictive :
   * on garde rues, bâtiments, eau, parcs, etc. mais on supprime TOUS
   * les calques symboles du fond OpenStreetMap afin qu'aucun nom réel,
   * numéro de route, POI ou pictogramme réel n'apparaisse.
   */
  return {
    ...style,
    layers: (style.layers || []).filter((layer) => layer.type !== "symbol"),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function xyToLngLat(x, y) {
  const ratioX = clamp(Number(x || 0) / MAP_WIDTH, 0, 1);
  const ratioY = clamp(Number(y || 0) / MAP_HEIGHT, 0, 1);

  return [
    GEO_BOUNDS.west + ratioX * (GEO_BOUNDS.east - GEO_BOUNDS.west),
    GEO_BOUNDS.north - ratioY * (GEO_BOUNDS.north - GEO_BOUNDS.south),
  ];
}

function getMapBounds() {
  return [
    [GEO_BOUNDS.west, GEO_BOUNDS.south],
    [GEO_BOUNDS.east, GEO_BOUNDS.north],
  ];
}

function createMarkerElement(item, selected = false) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `nova-gl-marker marker-${item.kind || "service"}${selected ? " is-selected" : ""}`;
  element.style.setProperty("--marker", item.color || "#6d28d9");
  element.setAttribute(
    "aria-label",
    `${item.name}. ${item.category || ""}. ${item.district || item.address || ""}`,
  );

  const pin = document.createElement("span");
  pin.className = "nova-gl-marker__pin";
  pin.textContent = item.icon || "•";

  const label = document.createElement("span");
  label.className = "nova-gl-marker__label";
  label.textContent = item.name;

  element.append(pin, label);
  return element;
}

function createDistrictElement(district) {
  const element = document.createElement("div");
  element.className = "nova-gl-district";

  const strong = document.createElement("strong");
  strong.textContent = district.name;

  const subtitle = document.createElement("span");
  subtitle.textContent = district.subtitle;

  element.append(strong, subtitle);
  return element;
}

const COPY = {
  fr: {
    title: "Carte 2D de Nova Terra",
    hint: "Plan urbain interactif de Nova Terra. Le fond reste sans noms réels ; seuls les lieux fictifs de la ville sont affichés.",
    fiction: "Plan fictif de Nova Terra",
    mapStyle: "Fond cartographique OpenFreeMap · sans libellés réels",
    list: "Lieux et événements visibles",
    searchPlaceholder: "Rechercher dans Nova Terra",
    searchHint: "Filtrez par nom, quartier ou catégorie",
    visibleCount: "éléments visibles",
    zoomIn: "Zoom avant",
    zoomOut: "Zoom arrière",
    reset: "Recentrer",
    openService: "Ouvrir le service",
    openReport: "Voir le signalement",
    openAlert: "Voir l'alerte",
    noSelection: "Sélectionnez un lieu sur la carte.",
    empty: "Aucun résultat avec ces filtres.",
    address: "Emplacement",
    hours: "Horaires",
    loading: "Chargement de la carte…",
    mapError: "Le fond cartographique n'a pas pu être chargé. Vérifiez la connexion internet.",
    locate: "Localiser",
    layers: {
      services: "Services",
      emergency: "Urgences",
      alerts: "Alertes",
      reports: "Signalements",
    },
  },
  en: {
    title: "Nova Terra 2D map",
    hint: "Interactive Nova Terra city map. The base map has no real-world names; only fictional city locations are shown.",
    fiction: "Fictional Nova Terra map",
    mapStyle: "OpenFreeMap basemap · real labels hidden",
    list: "Visible places and events",
    searchPlaceholder: "Search Nova Terra",
    searchHint: "Filter by name, district or category",
    visibleCount: "visible items",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    reset: "Reset",
    openService: "Open service",
    openReport: "View report",
    openAlert: "View alert",
    noSelection: "Select a place on the map.",
    empty: "No result with these filters.",
    address: "Location",
    hours: "Hours",
    loading: "Loading map…",
    mapError: "The map background could not be loaded. Check the internet connection.",
    locate: "Locate",
    layers: {
      services: "Services",
      emergency: "Emergency",
      alerts: "Alerts",
      reports: "Reports",
    },
  },
};

export default function NovaTerraMap({
  services = [],
  visibleSlugs = null,
  locale = "fr",
  mode = "services",
  transportStops = [],
  onTransportOpen = null,
}) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const mapLibreRef = useRef(null);
  const markerRefs = useRef([]);

  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [mapState, setMapState] = useState("loading");
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [layers, setLayers] = useState({
    transport: true,
    services: true,
    emergency: true,
    alerts: true,
    reports: true,
  });

  const copy = COPY[locale] || COPY.fr;
  const transportMode = mode === "transport";
  const activeCopy = transportMode
    ? {
        ...copy,
        title: locale === "en" ? "Nova Terra transport map" : locale === "mg" ? "Sarintanin’ny fitaterana Nova Terra" : "Carte 2D du transport de Nova Terra",
        hint: locale === "en"
          ? "The same interactive Nova Terra map used by municipal services, focused on stops and transport lines."
          : locale === "mg"
            ? "Ilay sarintany Nova Terra mitovy amin’ny serivisy, mifantoka amin’ny fijanonana sy ny zotra."
            : "Le même plan interactif Nova Terra que dans Services, centré sur les arrêts et les lignes.",
        list: locale === "en" ? "Visible stops" : locale === "mg" ? "Fijanonana hita" : "Arrêts visibles",
        searchPlaceholder: locale === "en" ? "Search a transport stop" : locale === "mg" ? "Hitady fijanonana" : "Rechercher un arrêt",
        searchHint: locale === "en" ? "Filter by stop, district or line" : locale === "mg" ? "Sivano amin’ny fijanonana, faritra na zotra" : "Filtrez par arrêt, quartier ou ligne",
        openTransport: locale === "en" ? "Open stop" : locale === "mg" ? "Hijery ny fijanonana" : "Voir l’arrêt",
        layers: { ...copy.layers, transport: locale === "en" ? "Stops" : locale === "mg" ? "Fijanonana" : "Arrêts" },
      }
    : copy;

  useEffect(() => {
    if (transportMode) {
      setAlerts([]);
      setReports([]);
      setLoadingData(false);
      return undefined;
    }

    let active = true;
    setLoadingData(true);

    Promise.allSettled([
      getAlerts({ page_size: 50 }),
      getCitizenRequests({ type: "report", page_size: 100, ordering: "-created_at" }),
    ]).then(([alertsResult, reportsResult]) => {
      if (!active) return;

      const alertRows = alertsResult.status === "fulfilled" ? alertsResult.value : [];
      const reportRows = reportsResult.status === "fulfilled" ? reportsResult.value : [];

      setAlerts(
        alertRows.filter((item) => item.publication_state !== "expired").slice(0, 20),
      );
      setReports(reportRows.filter((item) => !item.isClosed).slice(0, 40));
      setLoadingData(false);
    });

    return () => {
      active = false;
    };
  }, [transportMode]);

  const serviceLocations = useMemo(
    () =>
      buildServiceLocations(services).filter(
        (item) => !visibleSlugs || visibleSlugs.has(item.slug),
      ),
    [services, visibleSlugs],
  );

  const transportLocations = useMemo(
    () => buildTransportLocations(transportStops),
    [transportStops],
  );

  const reportLocations = useMemo(() => reports.map(projectReport), [reports]);

  const alertLocations = useMemo(
    () => [...alerts.map(projectAlert), ...reports.map(projectReportAlert)],
    [alerts, reports],
  );

  const allItems = useMemo(
    () =>
      transportMode
        ? transportLocations
        : [...serviceLocations, ...CITY_POIS, ...alertLocations, ...reportLocations],
    [transportMode, transportLocations, serviceLocations, alertLocations, reportLocations],
  );

  const visibleItems = useMemo(
    () =>
      allItems.filter((item) => {
        if (item.kind === "transport") return layers.transport;
        if (item.kind === "service") return layers.services;
        if (item.kind === "emergency") return layers.emergency;
        if (item.kind === "alert") return layers.alerts;
        if (item.kind === "report") return layers.reports;
        return true;
      }),
    [allItems, layers],
  );

  const searchedItems = useMemo(() => {
    const needle = normalizeText(query);
    if (!needle) return visibleItems;

    return visibleItems.filter((item) =>
      normalizeText(
        `${item.name} ${item.category} ${item.district} ${item.address}`,
      ).includes(needle),
    );
  }, [visibleItems, query]);

  const selected =
    searchedItems.find((item) => item.id === selectedId) ||
    searchedItems[0] ||
    null;

  useEffect(() => {
    if (!selectedId && searchedItems[0]) setSelectedId(searchedItems[0].id);
  }, [searchedItems, selectedId]);

  useEffect(() => {
    if (selectedId && !searchedItems.some((item) => item.id === selectedId)) {
      setSelectedId(searchedItems[0]?.id || "");
    }
  }, [searchedItems, selectedId]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([loadMapLibre(), loadNovaBaseStyle()])
      .then(([maplibregl, style]) => {
        if (cancelled || !mapElementRef.current || mapRef.current) return;

        mapLibreRef.current = maplibregl;

        const map = new maplibregl.Map({
          container: mapElementRef.current,
          style,
          bounds: getMapBounds(),
          fitBoundsOptions: { padding: 18, duration: 0 },
          minZoom: 11.5,
          maxZoom: 17.5,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          maxBounds: getMapBounds(),
        });

        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();

        map.on("load", () => {
          if (cancelled) return;
          mapRef.current = map;
          setMapState("ready");
          window.setTimeout(() => map.resize(), 0);
        });

        map.on("error", (event) => {
          if (!map.loaded() && event?.error) setMapState("error");
        });
      })
      .catch(() => {
        if (!cancelled) setMapState("error");
      });

    return () => {
      cancelled = true;
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      mapLibreRef.current = null;
    };
  }, []);

  useEffect(() => {
    const maplibregl = mapLibreRef.current;
    const map = mapRef.current;
    if (!maplibregl || !map || mapState !== "ready") return;

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    CITY_DISTRICTS.forEach((district) => {
      const element = createDistrictElement(district);
      const marker = new maplibregl.Marker({
        element,
        anchor: "center",
      })
        .setLngLat(xyToLngLat(district.center[0], district.center[1]))
        .addTo(map);

      markerRefs.current.push(marker);
    });

    searchedItems.forEach((item) => {
      const element = createMarkerElement(item, selected?.id === item.id);

      element.addEventListener("click", (event) => {
        event.stopPropagation();
        setSelectedId(item.id);
        focusItem(item);
      });

      const marker = new maplibregl.Marker({
        element,
        anchor: "left",
      })
        .setLngLat(xyToLngLat(item.x, item.y))
        .addTo(map);

      markerRefs.current.push(marker);
    });
  }, [searchedItems, selected?.id, mapState]);

  useEffect(() => {
    if (mapState !== "ready" || !mapRef.current) return;
    const timer = window.setTimeout(() => mapRef.current?.resize(), 60);
    return () => window.clearTimeout(timer);
  }, [mapState]);

  function focusItem(item) {
    const map = mapRef.current;
    if (!map || !item) return;

    setSelectedId(item.id);

    map.flyTo({
      center: xyToLngLat(item.x, item.y),
      zoom: Math.max(map.getZoom(), 15.1),
      duration: 550,
      essential: true,
    });
  }

  function resetView() {
    const map = mapRef.current;
    if (!map) return;

    map.fitBounds(getMapBounds(), {
      padding: 18,
      duration: 450,
      essential: true,
    });
  }

  function openSelected() {
    if (!selected) return;

    if (
      (selected.kind === "report" || selected.alertSource === "report") &&
      selected.reference
    ) {
      navigate(`/citizen/requests/${encodeURIComponent(selected.reference)}`);
      return;
    }

    if (selected.kind === "alert" && selected.slug) {
      navigate(`/citizen/news/${encodeURIComponent(selected.slug)}`);
      return;
    }

    if (selected.kind === "service" && selected.slug) {
      navigate(`/citizen/services/${encodeURIComponent(selected.slug)}`);
      return;
    }

    if (selected.kind === "transport") {
      if (typeof onTransportOpen === "function") {
        onTransportOpen(selected.source);
        return;
      }
      navigate("/citizen/transport");
      return;
    }

    if (selected.kind === "emergency") {
      navigate("/citizen/services");
    }
  }

  const actionLabel =
    selected?.kind === "transport"
      ? activeCopy.openTransport
      : selected?.kind === "report" || selected?.alertSource === "report"
        ? activeCopy.openReport
        : selected?.kind === "alert"
          ? activeCopy.openAlert
          : activeCopy.openService;

  const counts = {
    transport: transportLocations.length,
    services: serviceLocations.length,
    emergency: CITY_POIS.length,
    alerts: alertLocations.length,
    reports: reportLocations.length,
  };

  const layerButtons = transportMode
    ? [["transport", activeCopy.layers.transport]]
    : [
        ["services", activeCopy.layers.services],
        ["emergency", activeCopy.layers.emergency],
        ["alerts", activeCopy.layers.alerts],
        ["reports", activeCopy.layers.reports],
      ];

  return (
    <section className={`nova-city-map${transportMode ? " nova-city-map--transport" : ""}`} aria-label={activeCopy.title}>
      <header className="nova-city-map__header">
        <div>
          <span className="section-label">Nova Terra</span>
          <h3>{activeCopy.title}</h3>
          <p>{activeCopy.hint}</p>
        </div>

        <div className="nova-city-map__header-note">
          <strong>{activeCopy.fiction}</strong>
          <small>{activeCopy.mapStyle}</small>
        </div>
      </header>

      <div className="nova-city-map__layout">
        <div className="nova-map-frame">
          <div ref={mapElementRef} className="nova-map-canvas" />

          <div className="nova-map-toolbar">
            <label className="nova-map-search">
              <span aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={activeCopy.searchPlaceholder}
                aria-label={activeCopy.searchPlaceholder}
              />
            </label>

            <div className="nova-map-chipbar" role="toolbar" aria-label="Calques de la carte">
              {layerButtons.map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={layers[key]}
                  className={`chip-${key} ${layers[key] ? "is-active" : ""}`}
                  onClick={() =>
                    setLayers((current) => ({ ...current, [key]: !current[key] }))
                  }
                >
                  <i aria-hidden="true" />
                  <span>{label}</span>
                  <b>{counts[key]}</b>
                </button>
              ))}
            </div>

            <span className="nova-map-search-hint">{activeCopy.searchHint}</span>
          </div>

          <div className="nova-map-watermark" aria-live="polite">
            <strong>{searchedItems.length}</strong>
            <span>{activeCopy.visibleCount}</span>
          </div>

          <div className="nova-map-controls" aria-label="Contrôles de la carte">
            <button
              type="button"
              onClick={() => mapRef.current?.zoomIn({ duration: 250 })}
              aria-label={activeCopy.zoomIn}
            >
              +
            </button>
            <button
              type="button"
              onClick={() => mapRef.current?.zoomOut({ duration: 250 })}
              aria-label={activeCopy.zoomOut}
            >
              −
            </button>
            <button type="button" onClick={resetView} aria-label={activeCopy.reset}>
              ⌂
            </button>
          </div>

          <div className="nova-map-legend" aria-label="Légende">
            {transportMode ? (
              <span><i className="transport" />{activeCopy.layers.transport}</span>
            ) : (
              <>
                <span><i className="service" />Service</span>
                <span><i className="emergency" />Urgence</span>
                <span><i className="alert" />Alerte</span>
                <span><i className="report" />Signalement</span>
              </>
            )}
          </div>

          <div className="nova-map-attribution">
            © OpenStreetMap contributors · OpenFreeMap
          </div>

          {mapState === "loading" || loadingData ? (
            <div className="nova-map-state" role="status">{activeCopy.loading}</div>
          ) : null}

          {mapState === "error" ? (
            <div className="nova-map-state nova-map-state--error" role="alert">
              {activeCopy.mapError}
            </div>
          ) : null}
        </div>

        <aside className="nova-city-map__panel">
          {selected ? (
            <div className="nova-city-map__selected">
              <div
                className={`nova-city-map__selected-icon kind-${selected.kind}`}
                style={{ "--location-color": selected.color }}
                aria-hidden="true"
              >
                {selected.icon}
              </div>

              <span>{selected.category}</span>
              <h3>{selected.name}</h3>
              <p>{selected.description}</p>

              <dl>
                <div>
                  <dt>{activeCopy.address}</dt>
                  <dd>{selected.address || selected.district}</dd>
                </div>

                {selected.openingHours ? (
                  <div>
                    <dt>{activeCopy.hours}</dt>
                    <dd>{selected.openingHours}</dd>
                  </div>
                ) : null}

                {(selected.details || []).map((detail, index) => (
                  <div key={`${detail.label}-${index}`}>
                    <dt>{detail.label}</dt>
                    <dd>{detail.value}</dd>
                  </div>
                ))}

                {selected.statusLabel ? (
                  <div>
                    <dt>Statut</dt>
                    <dd>{selected.statusLabel}</dd>
                  </div>
                ) : null}
              </dl>

              <button type="button" className="primary-action" onClick={openSelected}>
                {actionLabel} →
              </button>
            </div>
          ) : (
            <div className="nova-city-map__empty">{activeCopy.noSelection}</div>
          )}

          <div className="nova-city-map__accessible-list">
            <span className="section-label">{activeCopy.list}</span>

            {searchedItems.length ? (
              searchedItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={selected?.id === item.id ? "is-active" : ""}
                  aria-pressed={selected?.id === item.id}
                  onClick={() => focusItem(item)}
                >
                  <i style={{ "--location-color": item.color }} aria-hidden="true">
                    {item.icon}
                  </i>
                  <span>
                    <b>{item.name}</b>
                    <small>{item.category} · {item.district}</small>
                  </span>
                  <em>{activeCopy.locate}</em>
                </button>
              ))
            ) : (
              <p>{activeCopy.empty}</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

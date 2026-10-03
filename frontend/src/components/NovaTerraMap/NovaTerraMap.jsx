import { useEffect, useMemo, useRef, useState } from "react";
import { getCitizenRequests } from "../../api/requests.js";
import { getAlerts } from "../../api/news.js";
import { navigate } from "../../utils/navigation.js";
import { CITY_DISTRICTS, CITY_POIS, buildServiceLocations, projectAlert, projectReport, projectReportAlert } from "./locations.js";
import "./NovaTerraMap.css";

const WIDTH = 1000;
const HEIGHT = 680;

const DISTRICT_SHAPES = {
  aster: "72,62 330,56 355,230 86,248",
  orion: "348,52 650,56 658,248 346,238",
  helios: "660,70 945,95 930,288 664,254",
  aurore: "305,244 635,248 660,452 298,446",
  solaris: "666,292 940,296 930,504 664,490",
  azura: "70,282 298,262 296,586 64,610",
  nexus: "305,454 654,456 650,626 304,624",
  lyra: "664,500 938,510 922,640 666,636",
};

const PRIMARY_ROADS = [
  { d: "M 40 270 C 230 248, 392 282, 590 266 S 820 240, 960 276", name: "Boulevard des Pionniers", x: 508, y: 260 },
  { d: "M 330 20 C 340 170, 325 320, 330 660", name: "Avenue Aster", x: 338, y: 330 },
  { d: "M 650 25 C 648 180, 651 382, 656 660", name: "Avenue des Comètes", x: 664, y: 344 },
  { d: "M 86 456 C 258 430, 432 450, 624 440 S 822 430, 956 446", name: "Rue Nébula", x: 500, y: 434 },
  { d: "M 88 606 C 260 570, 448 596, 612 582 S 810 566, 932 592", name: "Quai d’Azura", x: 486, y: 584 },
  { d: "M 730 70 C 758 210, 772 366, 810 620", name: "Allée Solstice", x: 776, y: 350 },
];

const SECONDARY_ROADS = [
  "M 155 90 C 200 140, 220 205, 230 248",
  "M 455 70 C 460 140, 482 190, 520 242",
  "M 770 112 C 790 156, 814 206, 834 255",
  "M 145 360 C 240 346, 310 360, 364 390",
  "M 446 300 C 500 326, 566 352, 620 386",
  "M 725 520 C 776 530, 838 548, 900 588",
  "M 445 522 C 505 520, 565 530, 620 560",
  "M 565 140 C 608 175, 636 205, 655 242",
];

const WATER_SHAPES = [
  "210,300 250,286 275,308 268,350 224,356 202,332",
  "742,360 812,340 846,376 830,428 756,422 724,388",
  "574,508 664,494 692,530 670,590 576,584 540,540",
];

const GREEN_AREAS = [
  "96,92 182,82 220,120 210,178 138,196 92,156",
  "385,88 472,72 548,112 548,182 470,196 396,166",
  "754,78 886,96 902,164 818,208 728,174 712,114",
  "126,500 242,476 274,548 232,612 118,600 90,544",
  "746,524 884,534 900,610 812,638 720,616 704,554",
];

const MAP_CHIPS = [
  ["services", "Services"],
  ["emergency", "Urgences"],
  ["alerts", "Alertes"],
  ["reports", "Signalements"],
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function markerLabel(item) {
  if (item.kind === "report") return `${item.name}. ${item.statusLabel || "Signalement"}. ${item.district}`;
  if (item.kind === "alert") return `${item.name}. ${item.category}. ${item.district}`;
  return `${item.name}. ${item.category}. ${item.address}`;
}

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

export default function NovaTerraMap({ services = [], visibleSlugs = null, locale = "fr" }) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [layers, setLayers] = useState({ services: true, emergency: true, alerts: true, reports: true });
  const [query, setQuery] = useState("");

  const copy = {
    fr: {
      title: "Carte 2D de Nova Terra",
      hint: "Plan fictif inspiré d’une carte moderne. Les données dynamiques restent celles de la plateforme.",
      list: "Lieux et événements visibles",
      details: "Informations",
      openService: "Ouvrir le service",
      openReport: "Voir le signalement",
      openAlert: "Voir l’alerte",
      empty: "Aucun élément visible avec ces filtres.",
      hours: "Horaires",
      address: "Emplacement",
      reset: "Recentrer",
      zoomIn: "Zoom avant",
      zoomOut: "Zoom arrière",
      fiction: "Plan fictif de Nova Terra",
      searchPlaceholder: "Rechercher dans Nova Terra",
      searchHint: "Filtrez par nom, quartier ou catégorie",
      loading: "Synchronisation des alertes et signalements…",
      visibleCount: "éléments visibles",
      filters: "Filtres",
      noSelection: "Sélectionnez un lieu, une alerte ou un signalement pour voir ses détails.",
      mapStyle: "Vue 2D · style carte urbaine",
    },
    en: {
      title: "Nova Terra 2D map",
      hint: "Fictional plan inspired by a modern map. Dynamic data still comes from the platform.",
      list: "Visible places and events",
      details: "Information",
      openService: "Open service",
      openReport: "View report",
      openAlert: "View alert",
      empty: "No visible item with these filters.",
      hours: "Hours",
      address: "Location",
      reset: "Reset map",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      fiction: "Fictional Nova Terra map",
      searchPlaceholder: "Search in Nova Terra",
      searchHint: "Filter by name, district or category",
      loading: "Syncing alerts and reports…",
      visibleCount: "visible items",
      filters: "Filters",
      noSelection: "Select a place, alert or report to see its details.",
      mapStyle: "2D view · urban map style",
    },
    mg: {
      title: "Sarintany 2D Nova Terra",
      hint: "Sarintany foronina mitovitovy amin’ny sarintany maoderina. Mbola avy amin’ny sehatra ihany ny angona mihetsika.",
      list: "Toerana sy zava-mitranga hita",
      details: "Fanazavana",
      openService: "Hijery serivisy",
      openReport: "Hijery tatitra",
      openAlert: "Hijery fanairana",
      empty: "Tsy misy zavatra hita amin’ireo sivana ireo.",
      hours: "Ora",
      address: "Toerana",
      reset: "Avereno afovoany",
      zoomIn: "Ampitomboy",
      zoomOut: "Ahena",
      fiction: "Sarintany foronina Nova Terra",
      searchPlaceholder: "Hitady ao Nova Terra",
      searchHint: "Sivano amin’ny anarana, faritra na sokajy",
      loading: "Ampifanarahana ny fanairana sy ny tatitra…",
      visibleCount: "zavatra hita",
      filters: "Sivana",
      noSelection: "Misafidiana toerana, fanairana na tatitra raha hijery ny antsipiriany.",
      mapStyle: "Fijery 2D · endrika sarintany an-tanàna",
    },
  }[locale] || null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      getAlerts({ page_size: 50 }),
      getCitizenRequests({ type: "report", page_size: 100, ordering: "-created_at" }),
    ]).then((results) => {
      if (!active) return;
      const alertRows = results[0].status === "fulfilled" ? results[0].value : [];
      const reportRows = results[1].status === "fulfilled" ? results[1].value : [];
      setAlerts(alertRows.filter((item) => item.publication_state !== "expired").slice(0, 20));
      setReports(reportRows.filter((item) => !item.isClosed).slice(0, 40));
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const serviceLocations = useMemo(
    () => buildServiceLocations(services).filter((item) => !visibleSlugs || visibleSlugs.has(item.slug)),
    [services, visibleSlugs],
  );
  const officialAlertLocations = useMemo(() => alerts.map(projectAlert), [alerts]);
  const reportLocations = useMemo(() => reports.map(projectReport), [reports]);
  const reportAlertLocations = useMemo(() => reports.map(projectReportAlert), [reports]);
  const alertLocations = useMemo(() => [...officialAlertLocations, ...reportAlertLocations], [officialAlertLocations, reportAlertLocations]);
  const allItems = useMemo(() => ([
    ...serviceLocations,
    ...CITY_POIS,
    ...alertLocations,
    ...reportLocations,
  ]), [serviceLocations, alertLocations, reportLocations]);

  const visibleItems = useMemo(() => allItems.filter((item) => {
    if (item.kind === "service") return layers.services;
    if (item.kind === "emergency") return layers.emergency;
    if (item.kind === "alert") return layers.alerts;
    if (item.kind === "report") return layers.reports;
    return true;
  }), [allItems, layers]);

  const searchedItems = useMemo(() => {
    const needle = normalizeText(query);
    if (!needle) return visibleItems;
    return visibleItems.filter((item) => normalizeText(`${item.name} ${item.category} ${item.district} ${item.address}`).includes(needle));
  }, [visibleItems, query]);

  const selected = searchedItems.find((item) => item.id === selectedId) || searchedItems[0] || null;
  useEffect(() => { if (selected && !selectedId) setSelectedId(selected.id); }, [selected, selectedId]);
  useEffect(() => {
    if (selectedId && !searchedItems.some((item) => item.id === selectedId)) setSelectedId(searchedItems[0]?.id || "");
  }, [searchedItems, selectedId]);

  const viewWidth = WIDTH / zoom;
  const viewHeight = HEIGHT / zoom;
  const viewX = clamp(pan.x, 0, WIDTH - viewWidth);
  const viewY = clamp(pan.y, 0, HEIGHT - viewHeight);

  function setZoomSafe(next) {
    const value = clamp(next, 1, 2.5);
    setZoom(value);
    setPan((current) => ({
      x: clamp(current.x, 0, WIDTH - WIDTH / value),
      y: clamp(current.y, 0, HEIGHT - HEIGHT / value),
    }));
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { clientX: event.clientX, clientY: event.clientY, panX: viewX, panY: viewY };
  }

  function onPointerMove(event) {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = viewWidth / rect.width;
    const scaleY = viewHeight / rect.height;
    setPan({
      x: clamp(drag.panX - (event.clientX - drag.clientX) * scaleX, 0, WIDTH - viewWidth),
      y: clamp(drag.panY - (event.clientY - drag.clientY) * scaleY, 0, HEIGHT - viewHeight),
    });
  }

  function onPointerUp(event) {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
  }

  function onWheel(event) {
    event.preventDefault();
    setZoomSafe(zoom + (event.deltaY < 0 ? 0.18 : -0.18));
  }

  function selectItem(item) {
    setSelectedId(item.id);
  }

  function activateItem(event, item) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectItem(item);
    }
  }

  function openSelected() {
    if (!selected) return;
    if (selected.kind === "report" && selected.reference) return navigate(`/citizen/requests/${encodeURIComponent(selected.reference)}`);
    if (selected.kind === "alert" && selected.reference) return navigate(`/citizen/requests/${encodeURIComponent(selected.reference)}`);
    if (selected.kind === "alert" && selected.slug) return navigate(`/citizen/news/${encodeURIComponent(selected.slug)}`);
    if (selected.kind === "service" && selected.slug) return navigate(`/citizen/services/${encodeURIComponent(selected.slug)}`);
    if (selected.kind === "emergency") return navigate("/citizen/services");
  }

  const actionLabel = selected?.kind === "report" || selected?.alertSource === "report"
    ? copy.openReport
    : selected?.kind === "alert"
      ? copy.openAlert
      : copy.openService;

  return <section className="nova-city-map nova-city-map--2d" aria-label={copy.title}>
    <header className="nova-city-map__header nova-city-map__header--map">
      <div>
        <span className="section-label">Nova Terra</span>
        <h3>{copy.title}</h3>
        <p>{copy.hint}</p>
      </div>
      <div className="nova-city-map__header-note">
        <strong>{copy.fiction}</strong>
        <small>{copy.mapStyle}</small>
      </div>
    </header>

    <div className="nova-city-map__layout nova-city-map__layout--immersive">
      <div className="nova-city-map__scene-card">
        <div className="nova-map-toolbar" aria-label={copy.filters}>
          <label className="nova-map-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchPlaceholder}
            />
          </label>
          <div className="nova-map-chipbar" role="toolbar" aria-label={copy.filters}>
            {MAP_CHIPS.map(([key, label]) => {
              const count = key === "services"
                ? serviceLocations.length
                : key === "emergency"
                  ? CITY_POIS.length
                  : key === "alerts"
                    ? alertLocations.length
                    : reportLocations.length;
              return <button
                type="button"
                key={key}
                aria-pressed={layers[key]}
                className={`${layers[key] ? "is-active" : ""} chip-${key}`.trim()}
                onClick={() => setLayers((current) => ({ ...current, [key]: !current[key] }))}
              >
                <i aria-hidden="true" />
                <span>{label}</span>
                <b>{count}</b>
              </button>;
            })}
          </div>
        </div>

        <div className="nova-map-search-hint">{copy.searchHint}</div>

        <div className="nova-map-controls" aria-label="Contrôles de la carte">
          <button type="button" onClick={() => setZoomSafe(zoom + 0.2)} aria-label={copy.zoomIn}>+</button>
          <button type="button" onClick={() => setZoomSafe(zoom - 0.2)} aria-label={copy.zoomOut}>−</button>
          <button type="button" onClick={resetView} aria-label={copy.reset}>⌂</button>
        </div>

        <div className="nova-map-watermark">
          <strong>{searchedItems.length}</strong>
          <span>{copy.visibleCount}</span>
        </div>

        <svg
          ref={svgRef}
          className="nova-map-svg"
          viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
          role="img"
          aria-label={`${copy.title}. ${searchedItems.length} ${copy.visibleCount}.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          <defs>
            <linearGradient id="nova-ground" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#2d4736" />
              <stop offset="35%" stopColor="#5f7354" />
              <stop offset="65%" stopColor="#897c5e" />
              <stop offset="100%" stopColor="#513f37" />
            </linearGradient>
            <pattern id="nova-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="currentColor" strokeOpacity=".05" strokeWidth="1" />
            </pattern>
            <filter id="nova-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity=".28" />
            </filter>
          </defs>

          <rect width={WIDTH} height={HEIGHT} className="nova-map-bg" />
          <rect width={WIDTH} height={HEIGHT} fill="url(#nova-ground)" opacity=".28" />

          <g className="nova-map-landuse">
            {GREEN_AREAS.map((points, index) => <polygon key={`green-${index}`} points={points} className="nova-map-park" />)}
            {WATER_SHAPES.map((points, index) => <polygon key={`water-${index}`} points={points} className="nova-map-water" />)}
          </g>

          <g className="nova-map-districts">
            {CITY_DISTRICTS.map((district) => <g key={district.id} className="nova-map-district">
              <polygon points={DISTRICT_SHAPES[district.id]} style={{ "--district": district.color }} />
              <text x={district.center[0]} y={district.center[1] - 8} textAnchor="middle" className="nova-map-district__name">{district.name}</text>
              <text x={district.center[0]} y={district.center[1] + 11} textAnchor="middle" className="nova-map-district__subtitle">{district.subtitle}</text>
            </g>)}
          </g>

          <rect width={WIDTH} height={HEIGHT} fill="url(#nova-grid)" className="nova-map-grid" />

          <g className="nova-map-roads nova-map-roads--secondary">
            {SECONDARY_ROADS.map((path, index) => <path key={`secondary-${index}`} d={path} />)}
          </g>

          <g className="nova-map-roads nova-map-roads--primary">
            {PRIMARY_ROADS.map((road) => <g key={road.name}><path d={road.d} /><text x={road.x} y={road.y}>{road.name}</text></g>)}
          </g>

          {layers.alerts ? alertLocations.map((item) => <g key={`${item.id}-zone`} className={`nova-alert-zone severity-${item.severity}`} aria-hidden="true">
            <circle cx={item.x} cy={item.y} r={item.radius} style={{ "--marker": item.color }} />
            <circle cx={item.x} cy={item.y} r={Math.max(30, item.radius * 0.48)} style={{ "--marker": item.color }} />
          </g>) : null}

          <g className="nova-map-markers">
            {searchedItems.map((item) => {
              const selectedNow = selected?.id === item.id;
              return <g
                key={item.id}
                transform={`translate(${item.x} ${item.y})`}
                className={`nova-map-marker marker-${item.kind} ${selectedNow ? "is-selected" : ""}`}
                style={{ "--marker": item.color }}
                role="button"
                tabIndex="0"
                aria-label={markerLabel(item)}
                aria-pressed={selectedNow}
                onClick={(event) => { event.stopPropagation(); selectItem(item); }}
                onKeyDown={(event) => activateItem(event, item)}
              >
                <circle r={item.kind === "alert" ? 16 : item.kind === "report" ? 14 : 17} className="nova-map-marker__halo" />
                <circle r={item.kind === "alert" ? 10 : item.kind === "report" ? 9.5 : 12} className="nova-map-marker__pin" filter="url(#nova-shadow)" />
                <text y="4" textAnchor="middle" className="nova-map-marker__icon">{item.icon}</text>
                {selectedNow ? <text y="-24" textAnchor="middle" className="nova-map-marker__label">{item.name}</text> : null}
              </g>;
            })}
          </g>
        </svg>

        {loading ? <div className="nova-map-loading" role="status">{copy.loading}</div> : null}

        <div className="nova-map-legend" aria-label="Légende">
          <span><i className="service" />Service</span>
          <span><i className="emergency" />Urgence</span>
          <span><i className="alert" />Alerte</span>
          <span><i className="report" />Signalement</span>
        </div>
      </div>

      <aside className="nova-city-map__panel">
        {selected ? <div className="nova-city-map__selected">
          <div className={`nova-city-map__selected-icon kind-${selected.kind}`} style={{ "--location-color": selected.color }} aria-hidden="true">{selected.icon}</div>
          <span>{selected.category}</span>
          <h3>{selected.name}</h3>
          <p>{selected.description}</p>
          <dl>
            <div><dt>{copy.address}</dt><dd>{selected.address || selected.district}</dd></div>
            {selected.openingHours ? <div><dt>{copy.hours}</dt><dd>{selected.openingHours}</dd></div> : null}
            {selected.kind === "report" ? <div><dt>Statut</dt><dd>{selected.statusLabel}</dd></div> : null}
          </dl>
          <button type="button" className="primary-action" onClick={openSelected}>{actionLabel} →</button>
        </div> : <div className="nova-city-map__empty">{copy.noSelection}</div>}

        <div className="nova-city-map__accessible-list">
          <span className="section-label">{copy.list}</span>
          {searchedItems.length ? searchedItems.map((item) => <button
            type="button"
            key={item.id}
            className={`${selected?.id === item.id ? "is-active" : ""} list-${item.kind}`.trim()}
            aria-pressed={selected?.id === item.id}
            onClick={() => selectItem(item)}
          >
            <i style={{ "--location-color": item.color }} aria-hidden="true">{item.icon}</i>
            <span><b>{item.name}</b><small>{item.category} · {item.district}</small></span>
            <em>Localiser</em>
          </button>) : <p>{copy.empty}</p>}
        </div>
      </aside>
    </div>
  </section>;
}

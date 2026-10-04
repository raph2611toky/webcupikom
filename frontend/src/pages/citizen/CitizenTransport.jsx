import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getCityTransport, getTransportStop, getTransportStops } from "../../api/transport.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useLocale } from "../../utils/i18n.js";

const COPY = {
  fr: { title:"Transport", eyebrow:"Espace citoyen", subtitle:"Lignes, arrêts, horaires et informations pratiques de Nova Terra.", search:"Rechercher un arrêt", allDistricts:"Tous les quartiers", allLines:"Toutes les lignes", nearby:"Autour de moi", citywide:"Toute la ville", stops:"Arrêts", lines:"Lignes", near:"À proximité", timetable:"Horaires", practical:"Infos pratiques", empty:"Aucun arrêt ne correspond à ces critères.", open:"Voir l'arrêt", distance:"Distance", address:"Adresse", district:"Quartier", close:"Fermer", locateError:"Impossible d’utiliser votre position. Vous pouvez toujours consulter tous les arrêts de la ville.", loading:"Chargement du transport…" },
  en: { title:"Transport", eyebrow:"Citizen space", subtitle:"Lines, stops, schedules and practical information for Nova Terra.", search:"Search a stop", allDistricts:"All districts", allLines:"All lines", nearby:"Near me", citywide:"Whole city", stops:"Stops", lines:"Lines", near:"Nearby", timetable:"Timetable", practical:"Practical info", empty:"No stop matches these filters.", open:"View stop", distance:"Distance", address:"Address", district:"District", close:"Close", locateError:"Your location could not be used. You can still browse all city stops.", loading:"Loading transport…" },
  mg: { title:"Fitaterana", eyebrow:"Sehatra olom-pirenena", subtitle:"Lalana, fijanonana, ora ary vaovao ilaina eto Nova Terra.", search:"Hitady fijanonana", allDistricts:"Faritra rehetra", allLines:"Lalana rehetra", nearby:"Akaiky ahy", citywide:"Tanàna manontolo", stops:"Fijanonana", lines:"Lalana", near:"Akaiky", timetable:"Ora", practical:"Vaovao ilaina", empty:"Tsy misy fijanonana mifanaraka amin'ny sivana.", open:"Hijery", distance:"Elanelana", address:"Adiresy", district:"Faritra", close:"Hidio", locateError:"Tsy afaka nampiasa ny toerana misy anao. Afaka mijery ny fijanonana rehetra ianao.", loading:"Mamaky fitaterana…" },
};

function lineName(line){return line?.name || line?.label || line?.id || String(line || "")}
function lineKey(line){return String(line?.id ?? line?.name ?? line)}
function stopPosition(stop,index,total){
  if(Number.isFinite(stop.latitude)&&Number.isFinite(stop.longitude)) return null;
  const col=index%5; const row=Math.floor(index/5)%3;
  return {x:12+col*19+(row%2?5:0),y:25+row*27};
}
function projectGps(stops){
  const geo=stops.filter(s=>Number.isFinite(s.latitude)&&Number.isFinite(s.longitude));
  if(!geo.length)return new Map();
  const lats=geo.map(s=>s.latitude), lons=geo.map(s=>s.longitude);
  const minLat=Math.min(...lats), maxLat=Math.max(...lats), minLon=Math.min(...lons), maxLon=Math.max(...lons);
  const latSpan=Math.max(.00001,maxLat-minLat), lonSpan=Math.max(.00001,maxLon-minLon);
  return new Map(geo.map(s=>[s.slug,{x:10+((s.longitude-minLon)/lonSpan)*80,y:82-((s.latitude-minLat)/latSpan)*64}]));
}

export default function CitizenTransport(){
  const [locale]=useLocale();
  const copy=COPY[locale]||COPY.fr;
  const [overview,setOverview]=useState({lines:[],stops:[]});
  const [stops,setStops]=useState([]);
  const [query,setQuery]=useState("");
  const [district,setDistrict]=useState("");
  const [line,setLine]=useState("");
  const [mode,setMode]=useState("city");
  const [selected,setSelected]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  async function loadCity(){
    setLoading(true);setError("");
    try{
      const [transport,stopRows]=await Promise.all([
        getCityTransport({district:district||undefined,line:line||undefined}),
        getTransportStops({district:district||undefined,search:query||undefined}),
      ]);
      setOverview(transport);
      setStops(stopRows.length?stopRows:transport.stops);
      setMode("city");
    }catch(err){setError(getApiErrorMessage(err,"Impossible de charger le transport."))}
    finally{setLoading(false)}
  }

  useEffect(()=>{loadCity()},[]);
  useEffect(()=>{
    const timer=setTimeout(()=>{ if(mode==="city") loadCity(); },220);
    return()=>clearTimeout(timer);
  },[query,district,line]);

  const allLines=useMemo(()=>{
    const map=new Map();
    [...overview.lines,...stops.flatMap(s=>s.lines||[])].forEach(l=>map.set(lineKey(l),l));
    return [...map.values()];
  },[overview.lines,stops]);
  const districts=useMemo(()=>[...new Set(stops.map(s=>s.district).filter(Boolean))].sort(),[stops]);
  const gpsMap=useMemo(()=>projectGps(stops),[stops]);

  async function nearMe(){
    if(!navigator.geolocation){setError(copy.locateError);return}
    setLoading(true);setError("");
    navigator.geolocation.getCurrentPosition(async(position)=>{
      try{
        const rows=await getTransportStops({lat:position.coords.latitude,lon:position.coords.longitude,radiusKm:15,search:query||undefined});
        setStops(rows);setMode("near");
      }catch(err){setError(getApiErrorMessage(err,copy.locateError))}
      finally{setLoading(false)}
    },()=>{setError(copy.locateError);setLoading(false)},{enableHighAccuracy:false,timeout:8000,maximumAge:120000});
  }

  async function openStop(stop){
    try{setSelected(await getTransportStop(stop.slug))}catch{setSelected(stop)}
  }

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow={copy.eyebrow} title={copy.title}/>
    <main className="portal-content tr87-page">
      <header className="tr87-heading"><div><p>{copy.subtitle}</p></div><div className="tr87-actions"><button className={mode==="city"?"is-active":""} onClick={loadCity}>▦ {copy.citywide}</button><button className={mode==="near"?"is-active":""} onClick={nearMe}>⌖ {copy.nearby}</button></div></header>
      {error?<div className="error-card" role="alert">{error}</div>:null}
      <section className="tr87-toolbar">
        <label className="tr87-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={copy.search}/></label>
        <select value={district} onChange={e=>setDistrict(e.target.value)}><option value="">{copy.allDistricts}</option>{districts.map(d=><option key={d} value={d}>{d}</option>)}</select>
        <select value={line} onChange={e=>setLine(e.target.value)}><option value="">{copy.allLines}</option>{allLines.map(l=><option key={lineKey(l)} value={lineKey(l)}>{lineName(l)}</option>)}</select>
      </section>

      <section className="tr87-summary">
        <article><span>◉</span><div><b>{stops.length}</b><small>{copy.stops}</small></div></article>
        <article><span>⇄</span><div><b>{allLines.length}</b><small>{copy.lines}</small></div></article>
        <article><span>⌖</span><div><b>{stops.filter(s=>s.distanceKm!=null).length}</b><small>{copy.near}</small></div></article>
      </section>

      <section className="tr87-layout">
        <div className="tr87-map-card">
          <div className="tr87-map" aria-label="Plan des arrêts de transport de Nova Terra">
            <svg viewBox="0 0 100 100" role="img" aria-label="Plan schématique du réseau de transport">
              <path className="tr87-road" d="M5 20 C28 10, 45 32, 95 18"/><path className="tr87-road" d="M8 75 C35 60, 52 86, 94 63"/><path className="tr87-road" d="M18 5 C25 34, 18 56, 34 96"/><path className="tr87-road" d="M63 4 C55 28, 74 54, 68 96"/>
              <text x="7" y="12">NORD</text><text x="7" y="92">SUD</text><text x="72" y="12">EST</text><text x="42" y="52">CENTRE</text>
              {stops.map((stop,index)=>{const p=gpsMap.get(stop.slug)||stopPosition(stop,index,stops.length);return <g key={stop.slug} className="tr87-stop-pin" onClick={()=>openStop(stop)} tabIndex="0" role="button"><circle cx={p.x} cy={p.y} r="2.7"/><circle cx={p.x} cy={p.y} r="1"/><title>{stop.name}</title></g>})}
            </svg>
          </div>
        </div>

        <div className="tr87-stop-list">
          {loading?<div className="tr87-empty">{copy.loading}</div>:stops.length?stops.map(stop=><article key={stop.slug} className="tr87-stop-card">
            <div className="tr87-stop-icon">⌖</div><div className="tr87-stop-main"><span>{stop.district||copy.district}</span><h3>{stop.name}</h3><p>{stop.address||stop.description||"—"}</p><div className="tr87-line-row">{(stop.lines||[]).slice(0,5).map(l=><b key={lineKey(l)}>{lineName(l)}</b>)}</div>{stop.distanceKm!=null?<small>{copy.distance}: {stop.distanceKm.toFixed(2)} km</small>:null}</div><button onClick={()=>openStop(stop)}>{copy.open} →</button>
          </article>):<div className="tr87-empty">{copy.empty}</div>}
        </div>
      </section>
    </main>

    {selected?<div className="tr87-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><section className="tr87-modal" role="dialog" aria-modal="true"><button className="tr87-close" onClick={()=>setSelected(null)}>×</button><span className="section-label">{selected.kindLabel}</span><h2>{selected.name}</h2><p>{selected.description}</p><div className="tr87-detail-grid"><div><span>{copy.address}</span><b>{selected.address||"—"}</b></div><div><span>{copy.district}</span><b>{selected.district||"—"}</b></div><div><span>{copy.lines}</span><b>{selected.lines.map(lineName).join(", ")||"—"}</b></div><div><span>{copy.distance}</span><b>{selected.distanceKm!=null?`${selected.distanceKm.toFixed(2)} km`:"—"}</b></div></div><div className="tr87-json-block"><strong>{copy.timetable}</strong>{selected.timetable.length?selected.timetable.map((row,i)=><div key={i}><span>{row.key||`#${i+1}`}</span><b>{typeof row.value==="object"?JSON.stringify(row.value):String(row.value??row)}</b></div>):<p>—</p>}</div><div className="tr87-json-block"><strong>{copy.practical}</strong><p>{Object.keys(selected.practicalInfo||{}).length?Object.entries(selected.practicalInfo).map(([k,v])=>`${k}: ${typeof v==="object"?JSON.stringify(v):v}`).join(" · "):"—"}</p></div></section></div>:null}
  </div></div>;
}

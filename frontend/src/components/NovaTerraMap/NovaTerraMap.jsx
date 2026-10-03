import { useEffect, useMemo, useRef, useState } from "react";
import { getCitizenRequests } from "../../api/requests.js";
import { getAlerts } from "../../api/news.js";
import { navigate } from "../../utils/navigation.js";
import { CITY_DISTRICTS, CITY_POIS, buildServiceLocations, projectAlert, projectReport } from "./locations.js";
import "./NovaTerraMap.css";

const WIDTH=1000;
const HEIGHT=680;

const DISTRICT_SHAPES={
  aster:"70,62 325,58 350,235 84,246",
  orion:"350,48 650,52 656,250 344,236",
  helios:"660,70 940,92 930,286 664,252",
  aurore:"300,250 630,250 660,450 300,442",
  solaris:"666,292 940,294 930,502 665,486",
  azura:"70,282 293,260 295,585 64,610",
  nexus:"304,454 655,457 650,628 305,624",
  lyra:"662,500 936,510 920,640 666,634",
};

const ROADS=[
  {d:"M 40 270 C 230 250, 390 280, 590 265 S 820 240, 960 275",name:"Boulevard des Pionniers",x:510,y:260},
  {d:"M 330 20 C 340 170, 325 320, 330 660",name:"Avenue Aster",x:340,y:330},
  {d:"M 650 25 C 650 180, 650 380, 655 660",name:"Avenue des Comètes",x:660,y:345},
  {d:"M 90 455 C 260 430, 430 450, 620 440 S 820 430, 955 445",name:"Rue Nébula",x:500,y:435},
  {d:"M 90 605 C 260 570, 450 595, 610 580 S 810 565, 930 590",name:"Quai d’Azura",x:485,y:583},
  {d:"M 730 70 C 760 210, 770 365, 810 620",name:"Allée Solstice",x:775,y:350},
];

const LAYER_COPY={services:"Services",emergency:"Urgences",alerts:"Alertes",reports:"Signalements"};

function clamp(value,min,max){return Math.max(min,Math.min(max,value))}

function markerLabel(item){
  if(item.kind==="report")return `${item.name}. ${item.statusLabel||"Signalement"}. ${item.district}`;
  if(item.kind==="alert")return `${item.name}. ${item.category}. ${item.district}`;
  return `${item.name}. ${item.category}. ${item.address}`;
}

export default function NovaTerraMap({services=[],visibleSlugs=null,locale="fr"}){
  const svgRef=useRef(null);
  const dragRef=useRef(null);
  const [alerts,setAlerts]=useState([]);
  const [reports,setReports]=useState([]);
  const [loading,setLoading]=useState(true);
  const [selectedId,setSelectedId]=useState("");
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState({x:0,y:0});
  const [layers,setLayers]=useState({services:true,emergency:true,alerts:true,reports:true});

  const copy={
    fr:{title:"Carte 2D de Nova Terra",hint:"Plan fictif · zoomez, déplacez et filtrez les couches",list:"Lieux et événements visibles",details:"Informations",openService:"Ouvrir le service",openReport:"Voir le signalement",openAlert:"Voir l’alerte",empty:"Aucun élément visible avec ces filtres.",hours:"Horaires",address:"Emplacement",reset:"Recentrer",zoomIn:"Zoom avant",zoomOut:"Zoom arrière",fiction:"Les noms et emplacements de cette carte sont fictifs et appartiennent à Nova Terra."},
    en:{title:"Nova Terra 2D map",hint:"Fictional plan · zoom, pan and filter layers",list:"Visible places and events",details:"Information",openService:"Open service",openReport:"View report",openAlert:"View alert",empty:"No visible item with these filters.",hours:"Hours",address:"Location",reset:"Reset map",zoomIn:"Zoom in",zoomOut:"Zoom out",fiction:"Names and locations on this map are fictional and belong to Nova Terra."},
    mg:{title:"Sarintany 2D Nova Terra",hint:"Sarintany foronina · ampitomboy, afindra ary sivano",list:"Toerana sy zava-mitranga hita",details:"Fanazavana",openService:"Hijery serivisy",openReport:"Hijery tatitra",openAlert:"Hijery fanairana",empty:"Tsy misy zavatra hita.",hours:"Ora",address:"Toerana",reset:"Avereno afovoany",zoomIn:"Ampitomboy",zoomOut:"Ahena",fiction:"Foronina ho an'i Nova Terra ireo anarana sy toerana eto amin'ny sarintany."},
  }[locale]||null;

  useEffect(()=>{
    let active=true;
    setLoading(true);
    Promise.allSettled([
      getAlerts({page_size:50}),
      getCitizenRequests({type:"report",page_size:100,ordering:"-created_at"}),
    ]).then(results=>{
      if(!active)return;
      const alertRows=results[0].status==="fulfilled"?results[0].value:[];
      const reportRows=results[1].status==="fulfilled"?results[1].value:[];
      setAlerts(alertRows.filter(item=>item.publication_state!=="expired").slice(0,20));
      setReports(reportRows.filter(item=>!item.isClosed).slice(0,40));
      setLoading(false);
    });
    return()=>{active=false};
  },[]);

  const serviceLocations=useMemo(()=>buildServiceLocations(services).filter(item=>!visibleSlugs||visibleSlugs.has(item.slug)),[services,visibleSlugs]);
  const alertLocations=useMemo(()=>alerts.map(projectAlert),[alerts]);
  const reportLocations=useMemo(()=>reports.map(projectReport),[reports]);
  const allItems=useMemo(()=>[
    ...serviceLocations,
    ...CITY_POIS,
    ...alertLocations,
    ...reportLocations,
  ],[serviceLocations,alertLocations,reportLocations]);

  const visibleItems=useMemo(()=>allItems.filter(item=>{
    if(item.kind==="service")return layers.services;
    if(item.kind==="emergency")return layers.emergency;
    if(item.kind==="alert")return layers.alerts;
    if(item.kind==="report")return layers.reports;
    return true;
  }),[allItems,layers]);

  const selected=visibleItems.find(item=>item.id===selectedId)||visibleItems[0]||null;
  useEffect(()=>{if(selected&&!selectedId)setSelectedId(selected.id)},[selected,selectedId]);
  useEffect(()=>{if(selectedId&&!visibleItems.some(item=>item.id===selectedId))setSelectedId(visibleItems[0]?.id||"")},[visibleItems,selectedId]);

  const viewWidth=WIDTH/zoom;
  const viewHeight=HEIGHT/zoom;
  const viewX=clamp(pan.x,0,WIDTH-viewWidth);
  const viewY=clamp(pan.y,0,HEIGHT-viewHeight);

  function setZoomSafe(next){
    const value=clamp(next,1,2.5);
    setZoom(value);
    setPan(current=>({x:clamp(current.x,0,WIDTH-WIDTH/value),y:clamp(current.y,0,HEIGHT-HEIGHT/value)}));
  }

  function resetView(){setZoom(1);setPan({x:0,y:0})}

  function onPointerDown(event){
    if(event.button!==0)return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current={clientX:event.clientX,clientY:event.clientY,panX:viewX,panY:viewY};
  }
  function onPointerMove(event){
    const drag=dragRef.current;if(!drag)return;
    const rect=svgRef.current?.getBoundingClientRect();if(!rect)return;
    const scaleX=viewWidth/rect.width;const scaleY=viewHeight/rect.height;
    setPan({x:clamp(drag.panX-(event.clientX-drag.clientX)*scaleX,0,WIDTH-viewWidth),y:clamp(drag.panY-(event.clientY-drag.clientY)*scaleY,0,HEIGHT-viewHeight)});
  }
  function onPointerUp(event){event.currentTarget.releasePointerCapture?.(event.pointerId);dragRef.current=null}
  function onWheel(event){event.preventDefault();setZoomSafe(zoom+(event.deltaY<0?.18:-.18))}

  function selectItem(item){setSelectedId(item.id)}
  function activateItem(event,item){if(event.key==="Enter"||event.key===" "){event.preventDefault();selectItem(item)}}

  function openSelected(){
    if(!selected)return;
    if(selected.kind==="report"&&selected.reference)return navigate(`/citizen/requests/${encodeURIComponent(selected.reference)}`);
    if(selected.kind==="alert"&&selected.slug)return navigate(`/citizen/news/${encodeURIComponent(selected.slug)}`);
    if(selected.kind==="service"&&selected.slug)return navigate(`/citizen/services/${encodeURIComponent(selected.slug)}`);
    if(selected.kind==="emergency")return navigate("/citizen/services");
  }

  const actionLabel=selected?.kind==="report"?copy.openReport:selected?.kind==="alert"?copy.openAlert:copy.openService;

  return <section className="nova-city-map nova-city-map--2d" aria-label={copy.title}>
    <header className="nova-city-map__header">
      <div><span className="section-label">Nova Terra</span><h3>{copy.title}</h3><small>{copy.fiction}</small></div>
      <span>{copy.hint}</span>
    </header>

    <div className="nova-map-layerbar" aria-label="Couches de la carte">
      {Object.entries(LAYER_COPY).map(([key,label])=><button type="button" key={key} aria-pressed={layers[key]} className={layers[key]?`is-active layer-${key}`:""} onClick={()=>setLayers(current=>({...current,[key]:!current[key]}))}><i aria-hidden="true"/>{label}<b>{key==="services"?serviceLocations.length:key==="emergency"?CITY_POIS.length:key==="alerts"?alertLocations.length:reportLocations.length}</b></button>)}
    </div>

    <div className="nova-city-map__layout">
      <div className="nova-city-map__scene-card">
        <div className="nova-map-controls" aria-label="Contrôles de la carte">
          <button type="button" onClick={()=>setZoomSafe(zoom+.2)} aria-label={copy.zoomIn}>+</button>
          <button type="button" onClick={()=>setZoomSafe(zoom-.2)} aria-label={copy.zoomOut}>−</button>
          <button type="button" onClick={resetView} aria-label={copy.reset}>⌂</button>
        </div>
        <svg ref={svgRef} className="nova-map-svg" viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`} role="img" aria-label={`${copy.title}. ${visibleItems.length} éléments visibles.`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}>
          <defs>
            <pattern id="nova-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="currentColor" strokeOpacity=".06" strokeWidth="1"/></pattern>
            <filter id="nova-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity=".18"/></filter>
          </defs>
          <rect width={WIDTH} height={HEIGHT} className="nova-map-bg"/>
          <rect width={WIDTH} height={HEIGHT} fill="url(#nova-grid)" className="nova-map-grid"/>

          {CITY_DISTRICTS.map(district=><g key={district.id} className="nova-map-district">
            <polygon points={DISTRICT_SHAPES[district.id]} style={{"--district":district.color}}/>
            <text x={district.center[0]} y={district.center[1]-8} textAnchor="middle" className="nova-map-district__name">{district.name}</text>
            <text x={district.center[0]} y={district.center[1]+11} textAnchor="middle" className="nova-map-district__subtitle">{district.subtitle}</text>
          </g>)}

          <g className="nova-map-roads">
            {ROADS.map(road=><g key={road.name}><path d={road.d}/><text x={road.x} y={road.y}>{road.name}</text></g>)}
          </g>

          {layers.alerts?alertLocations.map(item=><g key={`${item.id}-zone`} className={`nova-alert-zone severity-${item.severity}`} aria-hidden="true"><circle cx={item.x} cy={item.y} r={item.radius} style={{"--marker":item.color}}/><circle cx={item.x} cy={item.y} r={Math.max(28,item.radius*.48)} style={{"--marker":item.color}}/></g>):null}

          <g className="nova-map-markers">
            {visibleItems.map(item=>{
              const selectedNow=selected?.id===item.id;
              return <g key={item.id} transform={`translate(${item.x} ${item.y})`} className={`nova-map-marker marker-${item.kind} ${selectedNow?"is-selected":""}`} style={{"--marker":item.color}} role="button" tabIndex="0" aria-label={markerLabel(item)} aria-pressed={selectedNow} onClick={(event)=>{event.stopPropagation();selectItem(item)}} onKeyDown={event=>activateItem(event,item)}>
                <circle r={item.kind==="alert"?17:item.kind==="report"?15:18} className="nova-map-marker__halo"/>
                <circle r={item.kind==="alert"?11:item.kind==="report"?10:13} className="nova-map-marker__pin" filter="url(#nova-shadow)"/>
                <text y="4" textAnchor="middle" className="nova-map-marker__icon">{item.icon}</text>
                {selectedNow?<text y="-24" textAnchor="middle" className="nova-map-marker__label">{item.name}</text>:null}
              </g>;
            })}
          </g>
        </svg>
        {loading?<div className="nova-map-loading" role="status">Synchronisation des alertes et signalements…</div>:null}
        <div className="nova-map-legend" aria-label="Légende"><span><i className="service"/>Service</span><span><i className="emergency"/>Urgence</span><span><i className="alert"/>Alerte</span><span><i className="report"/>Signalement</span></div>
      </div>

      <aside className="nova-city-map__panel">
        {selected?<div className="nova-city-map__selected">
          <div className={`nova-city-map__selected-icon kind-${selected.kind}`} style={{"--location-color":selected.color}} aria-hidden="true">{selected.icon}</div>
          <span>{selected.category}</span>
          <h3>{selected.name}</h3>
          <p>{selected.description}</p>
          <dl>
            <div><dt>{copy.address}</dt><dd>{selected.address||selected.district}</dd></div>
            {selected.openingHours?<div><dt>{copy.hours}</dt><dd>{selected.openingHours}</dd></div>:null}
            {selected.kind==="report"?<div><dt>Statut</dt><dd>{selected.statusLabel}</dd></div>:null}
          </dl>
          <button type="button" className="primary-action" onClick={openSelected}>{actionLabel} →</button>
        </div>:<div className="nova-city-map__empty">{copy.empty}</div>}

        <div className="nova-city-map__accessible-list">
          <span className="section-label">{copy.list}</span>
          {visibleItems.length?visibleItems.map(item=><button type="button" key={item.id} className={`${selected?.id===item.id?"is-active":""} list-${item.kind}`} aria-pressed={selected?.id===item.id} onClick={()=>selectItem(item)}>
            <i style={{"--location-color":item.color}} aria-hidden="true">{item.icon}</i>
            <span><b>{item.name}</b><small>{item.category} · {item.district}</small></span>
            <em>Localiser</em>
          </button>):<p>{copy.empty}</p>}
        </div>
      </aside>
    </div>
  </section>;
}

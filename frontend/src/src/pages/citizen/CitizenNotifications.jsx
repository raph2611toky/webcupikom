import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { notifyNotificationStateChanged } from "../../components/ui/NotificationBell.jsx";
import {
  getCitizenNotification,
  getCitizenNotifications,
  markAllNotificationsRead,
  setNotificationRead,
} from "../../api/notifications.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const COPY={
  fr:{
    eyebrow:"Centre de notifications",title:"Notifications",all:"Tout marquer comme lu",
    loading:"Chargement des notifications…",empty:"Aucune notification pour ce filtre.",
    error:"Impossible de charger les notifications.",allFilter:"Toutes",unread:"Non lues",
    read:"Lue",refresh:"Actualiser",detail:"Détail de la notification",close:"Fermer",
    open:"Ouvrir",received:"Reçue",status:"Statut",type:"Type",backend:"Synchronisé avec Nova Terra",markUnread:"Marquer comme non lue",markRead:"Marquer comme lue"
  },
  en:{
    eyebrow:"Notification center",title:"Notifications",all:"Mark all as read",
    loading:"Loading notifications…",empty:"No notification for this filter.",
    error:"Unable to load notifications.",allFilter:"All",unread:"Unread",
    read:"Read",refresh:"Refresh",detail:"Notification details",close:"Close",
    open:"Open",received:"Received",status:"Status",type:"Type",backend:"Synced with Nova Terra",markUnread:"Mark as unread",markRead:"Mark as read"
  },
  mg:{
    eyebrow:"Foiben'ny fampahafantarana",title:"Fampahafantarana",all:"Mariho ho voavaky rehetra",
    loading:"Mampiditra fampahafantarana…",empty:"Tsy misy fampahafantarana amin'ity sivana ity.",
    error:"Tsy afaka mampiseho ny fampahafantarana.",allFilter:"Rehetra",unread:"Tsy voavaky",
    read:"Voavaky",refresh:"Havaozina",detail:"Antsipirian'ny fampahafantarana",close:"Hakatona",
    open:"Hanokatra",received:"Voaray",status:"Sata",type:"Karazana",backend:"Mifandray amin'i Nova Terra",markUnread:"Mariho ho tsy voavaky",markRead:"Mariho ho voavaky"
  }
};

const TYPE_META={
  "Démarche":{icon:"◎",className:"type-request"},
  "Signalement":{icon:"!",className:"type-report"},
  "Service":{icon:"◇",className:"type-service"},
  "Rendez-vous":{icon:"◷",className:"type-appointment"},
  "Message":{icon:"✉",className:"type-message"},
  "Information":{icon:"i",className:"type-info"},
};


function NotificationIcon({kind="info",size=20}){
  const common={width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.9",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true"};
  if(kind==="mail")return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4.5 7 7.5 6 7.5-6"/></svg>;
  if(kind==="unread")return <svg {...common}><path d="M5 6.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-4.5 3v-3H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"/><path d="M8 10h8M8 13h5"/></svg>;
  if(kind==="calendar")return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 9h16"/><path d="M8 13h3M14 13h2M8 16h2"/></svg>;
  if(kind==="request")return <svg {...common}><path d="M12 3a4 4 0 0 1 4 4v2.5c0 1.2.35 2.38 1 3.38l1.1 1.7A1.55 1.55 0 0 1 16.8 17H7.2a1.55 1.55 0 0 1-1.3-2.42l1.1-1.7a6.2 6.2 0 0 0 1-3.38V7a4 4 0 0 1 4-4Z"/><path d="M10 20h4"/></svg>;
  if(kind==="filter")return <svg {...common}><path d="M4 6h16M7 12h10M10 18h4"/></svg>;
  if(kind==="service")return <svg {...common}><path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-3-3 2.4-2.4Z"/></svg>;
  if(kind==="appointment")return <svg {...common}><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 20a4 4 0 0 1 7 0"/></svg>;
  if(kind==="report")return <svg {...common}><path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9h8M8 12h5"/></svg>;
  if(kind==="message")return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>;
}

const FILTER_ICON={
  "Toutes":"mail",
  "Non lues":"unread",
  "Démarche":"calendar",
  "Service":"service",
  "Rendez-vous":"appointment",
  "Signalement":"report",
  "Message":"message",
  "Information":"info",
};

function filterClass(value){
  return `filter-${String(value).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}`;
}

function metaFor(type){
  return TYPE_META[type]||TYPE_META.Information;
}

function formatCreated(value,locale="fr"){
  if(!value)return "—";
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return String(value);
  return new Intl.DateTimeFormat(locale==="en"?"en-GB":locale==="mg"?"mg-MG":"fr-FR",{
    day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"
  }).format(date);
}

function targetFor(item){
  if(item.request_reference){
    const isReport=String(item.category||item.notification_type||item.type||"").toLowerCase().includes("signal");
    return isReport
      ? `/citizen/requests/${encodeURIComponent(item.request_reference)}`
      : `/citizen/requests/${encodeURIComponent(item.request_reference)}`;
  }
  if(item.appointment_id)return "/citizen/appointments";
  if(item.contact_reference)return `/citizen/messages/${encodeURIComponent(item.contact_reference)}`;
  if(item.service_slug)return `/citizen/services/${encodeURIComponent(item.service_slug)}`;
  if(item.action_url){
    const target=String(item.action_url);
    if(target.startsWith("/"))return target;
  }
  return "";
}

export default function CitizenNotifications(){
  const [locale]=useLocale();
  const copy=COPY[locale]||COPY.fr;
  const [items,setItems]=useState([]);
  const [selected,setSelected]=useState(null);
  const [loading,setLoading]=useState(true);
  const [detailLoading,setDetailLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [filter,setFilter]=useState("Toutes");

  async function load({silent=false}={}){
    if(!silent)setLoading(true);
    setError("");
    try{
      const data=await getCitizenNotifications();
      setItems(data);
      notifyNotificationStateChanged();
    }catch(err){
      setError(getApiErrorMessage(err,copy.error));
    }finally{
      if(!silent)setLoading(false);
    }
  }

  useEffect(()=>{
    let active=true;
    load();
    const timer=window.setInterval(()=>{if(active)load({silent:true})},30000);
    const onFocus=()=>load({silent:true});
    window.addEventListener("focus",onFocus);
    return()=>{
      active=false;
      window.clearInterval(timer);
      window.removeEventListener("focus",onFocus);
    };
  },[locale]);

  const normalized=useMemo(()=>items.map(item=>({
    ...item,
    notificationType:item.category||"Information",
    typeMeta:metaFor(item.category||"Information"),
    eventStatus:item.event_status||"",
  })),[items]);

  const filters=useMemo(()=>[
    ["Toutes",copy.allFilter],
    ["Non lues",copy.unread],
    ...["Démarche","Service","Rendez-vous","Signalement","Message","Information"].map(type=>[type,type]),
  ],[copy]);

  const visible=useMemo(()=>normalized.filter(item=>{
    if(filter==="Toutes")return true;
    if(filter==="Non lues")return !item.is_read;
    return item.notificationType===filter;
  }),[normalized,filter]);

  const overview=useMemo(()=>({
    total:normalized.length,
    unread:normalized.filter(item=>!item.is_read).length,
    appointments:normalized.filter(item=>item.notificationType==="Rendez-vous").length,
    requests:normalized.filter(item=>["Démarche","Signalement"].includes(item.notificationType)).length,
  }),[normalized]);

  async function openNotification(item){
    setDetailLoading(true);
    setError("");
    try{
      let detail=await getCitizenNotification(item.id);
      if(!detail.is_read){
        detail=await setNotificationRead(item.id,true);
      }
      setItems(rows=>rows.map(row=>String(row.id)===String(item.id)?{...row,...detail,is_read:true}:row));
      setSelected({...detail,notificationType:detail.category||"Information",typeMeta:metaFor(detail.category||"Information")});
      notifyNotificationStateChanged();
    }catch(err){
      setError(getApiErrorMessage(err,copy.error));
    }finally{
      setDetailLoading(false);
    }
  }

  async function readAll(){
    setBusy(true);setError("");
    try{
      await markAllNotificationsRead();
      setItems(rows=>rows.map(row=>({...row,is_read:true})));
      if(selected)setSelected(current=>({...current,is_read:true}));
      notifyNotificationStateChanged();
    }catch(err){
      setError(getApiErrorMessage(err,copy.error));
    }finally{
      setBusy(false);
    }
  }

  async function toggleSelectedRead(){
    if(!selected)return;
    setBusy(true);setError("");
    try{
      const updated=await setNotificationRead(selected.id,!selected.is_read);
      setSelected(current=>({...current,...updated,is_read:updated.is_read}));
      setItems(rows=>rows.map(row=>String(row.id)===String(selected.id)?{...row,...updated}:row));
      notifyNotificationStateChanged();
    }catch(err){
      setError(getApiErrorMessage(err,copy.error));
    }finally{
      setBusy(false);
    }
  }

  function openTarget(item){
    const target=targetFor(item);
    if(target)navigate(target);
  }

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow={copy.eyebrow} title={copy.title} actions={
      <div className="notification-top-actions">
        <button className="topbar-ghost" type="button" onClick={()=>load()} disabled={loading}>{copy.refresh}</button>
        <button className="topbar-ghost" type="button" onClick={readAll} disabled={busy||!overview.unread}>{copy.all}</button>
      </div>
    }/>
    <main className="portal-content notification-center-page">
      {error?<div className="error-card" role="alert">{error}</div>:null}

      <section className="notification-overview notification-overview--backend notification-kpi-grid" aria-label="Résumé des notifications">
        <div className="notification-kpi-card kpi-total">
          <i className="notification-kpi-icon"><NotificationIcon kind="mail"/></i>
          <div><span>Total</span><strong>{overview.total}</strong><small>{copy.backend}</small></div>
        </div>
        <div className="notification-kpi-card kpi-unread">
          <i className="notification-kpi-icon"><NotificationIcon kind="unread"/></i>
          <div><span>{copy.unread}</span><strong>{overview.unread}</strong><small>À consulter</small></div>
        </div>
        <div className="notification-kpi-card kpi-appointments">
          <i className="notification-kpi-icon"><NotificationIcon kind="appointment"/></i>
          <div><span>Rendez-vous</span><strong>{overview.appointments}</strong><small>Informations et rappels</small></div>
        </div>
        <div className="notification-kpi-card kpi-requests">
          <i className="notification-kpi-icon"><NotificationIcon kind="request"/></i>
          <div><span>Démarches / signalements</span><strong>{overview.requests}</strong><small>Suivi des demandes</small></div>
        </div>
      </section>

      <section className="toolbar-card notification-toolbar notification-category-card">
        <div className="notification-category-title"><NotificationIcon kind="filter" size={17}/><strong>Catégories</strong></div>
        <div className="management-filter-row notification-filter-row notification-filter-row--visual">
          {filters.map(([value,label])=>{
            const count=value==="Toutes"?normalized.length:value==="Non lues"?overview.unread:normalized.filter(item=>item.notificationType===value).length;
            return <button
              key={value}
              type="button"
              className={`${filterClass(value)} ${filter===value?"is-active":""}`}
              aria-pressed={filter===value}
              onClick={()=>setFilter(value)}
            ><i aria-hidden="true"><NotificationIcon kind={FILTER_ICON[value]||"info"} size={15}/></i><span>{label}</span><small>{count}</small></button>;
          })}
        </div>
      </section>

      <section className={`notification-workspace ${selected?"has-detail":""}`}>
        <div className="portal-card notification-list notification-list--backend">
          {loading&&!items.length?<div className="notification-loading-state"><i/><span>{copy.loading}</span></div>:null}
          {!loading&&!visible.length?<div className="notification-empty-state"><i aria-hidden="true">✓</i><strong>{copy.empty}</strong><span>{filter==="Non lues"?"Tout est à jour.":"Les nouvelles notifications apparaîtront ici."}</span></div>:null}

          {visible.map(item=><button
            key={item.id}
            type="button"
            className={`${item.typeMeta.className} ${!item.is_read?"is-unread":""} ${String(selected?.id)===String(item.id)?"is-selected":""}`}
            onClick={()=>openNotification(item)}
          >
            <i className={`notification-type-icon ${item.typeMeta.className}`} aria-hidden="true"><NotificationIcon kind={FILTER_ICON[item.notificationType]||"info"} size={20}/></i>
            <div className="notification-main">
              <div className="notification-title-line">
                <strong>{item.title}</strong>
                {!item.is_read?<span className="notification-new-dot" aria-label={copy.unread}/>:null}
              </div>
              <p>{item.message||"—"}</p>
              <div className="notification-meta">
                <em className={`notification-type-badge ${item.typeMeta.className}`}>{item.notificationType}</em>
                {item.eventStatus?<em className="notification-event-status">{item.eventStatus}</em>:null}
                <span className="notification-date"><NotificationIcon kind="calendar" size={13}/>{formatCreated(item.created_at,locale)}</span>
              </div>
            </div>
            <span className="notification-arrow" aria-hidden="true">→</span>
          </button>)}
        </div>

        {selected?<aside className="portal-card notification-detail-panel" aria-label={copy.detail}>
          <div className="notification-detail-panel__head">
            <div>
              <span className="section-label">{copy.detail}</span>
              <h2>{selected.title}</h2>
            </div>
            <button type="button" aria-label={copy.close} onClick={()=>setSelected(null)}>×</button>
          </div>

          <div className={`notification-detail-icon ${selected.typeMeta?.className||""}`} aria-hidden="true">
            <NotificationIcon kind={FILTER_ICON[selected.notificationType]||"info"} size={21}/>
          </div>

          <p className="notification-detail-message">{selected.message||"—"}</p>

          <div className="notification-detail-facts">
            <div><span>{copy.type}</span><b>{selected.notificationType||selected.category||"Information"}</b></div>
            <div><span>{copy.status}</span><b>{selected.event_status||selected.status||"—"}</b></div>
            <div><span>{copy.received}</span><b>{formatCreated(selected.created_at,locale)}</b></div>
            <div><span>Lecture</span><b>{selected.is_read?copy.read:copy.unread}</b></div>
          </div>

          <div className="notification-detail-actions">
            <button className="secondary-action" type="button" onClick={toggleSelectedRead} disabled={busy}>
              {selected.is_read?copy.markUnread:copy.markRead}
            </button>
            {targetFor(selected)?<button className="primary-action notification-detail-open" type="button" onClick={()=>openTarget(selected)}>{copy.open} →</button>:null}
          </div>
        </aside>:detailLoading?<aside className="portal-card notification-detail-panel notification-detail-panel--loading"><div className="loading-card">Chargement…</div></aside>:null}
      </section>
    </main>
  </div></div>;
}

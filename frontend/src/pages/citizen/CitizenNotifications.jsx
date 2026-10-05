import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import PortalPagination from "../../components/ui/PortalPagination.jsx";
import PortalActionDialog from "../../components/ui/PortalActionDialog.jsx";
import { notifyNotificationStateChanged } from "../../components/ui/NotificationBell.jsx";
import {
  getCitizenNotification,
  getCitizenNotifications,
  markAllNotificationsRead,
  setNotificationRead,
} from "../../api/notifications.js";
import { getApiErrorMessage, invalidateSessionBootstrap } from "../../api/auth.js";
import { clearAccessToken } from "../../api/api.js";
import { getAccountSecurityEvents } from "../../api/securityEvents.js";
import {
  confirmSessionRevocation,
  getAccountSessions,
  logoutCurrentAccountSession,
  requestSessionRevocation,
} from "../../api/sessions.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import useRealtimeRefresh from "../../realtime/useRealtimeRefresh.js";

const COPY={
  fr:{
    eyebrow:"Espace citoyen",title:"Notifications",subtitle:"Restez informé de l’état de vos demandes, rendez-vous et signalements.",all:"Tout marquer comme lu",
    loading:"Chargement des notifications…",empty:"Aucune notification pour ce filtre.",
    error:"Impossible de charger les notifications.",allFilter:"Toutes",unread:"Non lues",
    read:"Lue",refresh:"Actualiser",detail:"Détail de la notification",close:"Fermer",
    open:"Ouvrir",received:"Reçue",status:"Statut",type:"Type",backend:"Synchronisé avec Nova Terra",markUnread:"Marquer comme non lue",markRead:"Marquer comme lue",
    security:"Sécurité",revoke:"Révoquer la session",revokeTitle:"Révoquer cette session ?",revokeText:"Cette notification concerne une session de connexion. Vérifiez l’appareil avant de demander sa déconnexion.",
    sendCode:"Envoyer le code de sécurité",otpTitle:"Confirmer la révocation",otpText:"Un code a été envoyé à votre adresse e-mail. Saisissez-le pour révoquer cette session.",
    otpLabel:"Code reçu par e-mail",otpPlaceholder:"000000",otpConfirm:"Révoquer maintenant",currentTitle:"Déconnecter cet appareil ?",currentText:"Cette notification correspond à la session actuellement utilisée. La déconnexion vous renverra vers la page de connexion.",
    currentConfirm:"Déconnecter cet appareil",revoked:"Session révoquée",revokedText:"La session a été déconnectée et l’activité de sécurité a été actualisée.",
    alreadyRevoked:"Cette session n’est plus active ou a déjà été révoquée.",sessionMissing:"Impossible d’identifier précisément la session liée à cette notification.",device:"Appareil",ip:"Adresse IP",lastSeen:"Dernière activité",sessionState:"État de session"
  },
  en:{
    eyebrow:"Citizen space",title:"Notifications",subtitle:"Stay informed about your requests, appointments and reports.",all:"Mark all as read",
    loading:"Loading notifications…",empty:"No notification for this filter.",
    error:"Unable to load notifications.",allFilter:"All",unread:"Unread",
    read:"Read",refresh:"Refresh",detail:"Notification details",close:"Close",
    open:"Open",received:"Received",status:"Status",type:"Type",backend:"Synced with Nova Terra",markUnread:"Mark as unread",markRead:"Mark as read",
    security:"Security",revoke:"Revoke session",revokeTitle:"Revoke this session?",revokeText:"This notification is linked to a login session. Check the device before disconnecting it.",
    sendCode:"Send security code",otpTitle:"Confirm revocation",otpText:"A code was sent to your email address. Enter it to revoke this session.",
    otpLabel:"Email security code",otpPlaceholder:"000000",otpConfirm:"Revoke now",currentTitle:"Sign out this device?",currentText:"This notification belongs to the session you are currently using. Signing it out will return you to login.",
    currentConfirm:"Sign out this device",revoked:"Session revoked",revokedText:"The session was disconnected and security activity was refreshed.",
    alreadyRevoked:"This session is no longer active or has already been revoked.",sessionMissing:"The session linked to this notification could not be identified safely.",device:"Device",ip:"IP address",lastSeen:"Last activity",sessionState:"Session status"
  },
  mg:{
    eyebrow:"Sehatra olom-pirenena",title:"Fampahafantarana",subtitle:"Araho eto ny fangatahanao, ny fotoana ary ny tatitrao.",all:"Mariho ho voavaky rehetra",
    loading:"Mampiditra fampahafantarana…",empty:"Tsy misy fampahafantarana amin'ity sivana ity.",
    error:"Tsy afaka mampiseho ny fampahafantarana.",allFilter:"Rehetra",unread:"Tsy voavaky",
    read:"Voavaky",refresh:"Havaozina",detail:"Antsipirian'ny fampahafantarana",close:"Hakatona",
    open:"Hanokatra",received:"Voaray",status:"Sata",type:"Karazana",backend:"Mifandray amin'i Nova Terra",markUnread:"Mariho ho tsy voavaky",markRead:"Mariho ho voavaky",
    security:"Fiarovana",revoke:"Esory ny session",revokeTitle:"Esorina ve ity session ity?",revokeText:"Mifandray amin’ny session fidirana ity fampahafantarana ity. Hamarino aloha ilay fitaovana.",
    sendCode:"Alefaso ny kaody fiarovana",otpTitle:"Hamarino ny fanafoanana session",otpText:"Nisy kaody nalefa tamin’ny mailakao. Ampidiro eto ilay kaody.",
    otpLabel:"Kaody avy amin’ny mailaka",otpPlaceholder:"000000",otpConfirm:"Esory izao",currentTitle:"Hivoaka amin’ity fitaovana ity?",currentText:"Ity no session ampiasainao amin’izao. Rehefa esorina dia hiverina any amin’ny pejy fidirana ianao.",
    currentConfirm:"Hivoaka amin’ity fitaovana ity",revoked:"Voaroaka ny session",revokedText:"Voaroaka ilay session ary nohavaozina ny hetsika fiarovana.",
    alreadyRevoked:"Tsy active intsony na efa voaroaka ity session ity.",sessionMissing:"Tsy voafaritra mazava ilay session mifandray amin’ity fampahafantarana ity.",device:"Fitaovana",ip:"IP",lastSeen:"Hetsika farany",sessionState:"Satan’ny session"
  }
};

const TYPE_META={
  "Démarche":{icon:"◎",className:"type-request"},
  "Signalement":{icon:"!",className:"type-report"},
  "Service":{icon:"◇",className:"type-service"},
  "Rendez-vous":{icon:"◷",className:"type-appointment"},
  "Message":{icon:"✉",className:"type-message"},
  "Sécurité":{icon:"⌾",className:"type-security"},
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
  if(kind==="security")return <svg {...common}><path d="M12 3 5 6v5c0 4.6 2.8 7.7 7 10 4.2-2.3 7-5.4 7-10V6l-7-3Z"/><path d="M9.5 12 11 13.5l3.8-4"/></svg>;
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
  "Sécurité":"security",
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


function isActiveSession(session){
  return Boolean(
    session &&
    !session.revokedAt &&
    String(session.status || "active").toLowerCase() === "active"
  );
}

function securityCandidateScore(session, notification){
  let score=0;

  if(notification.session_id && String(session.id)===String(notification.session_id)) score+=100;

  const wantedDevice=String(notification.security_device_label||"").trim().toLowerCase();
  const sessionDevice=String(session.device?.label||"").trim().toLowerCase();
  if(wantedDevice && sessionDevice && wantedDevice===sessionDevice) score+=20;

  const wantedIp=String(notification.security_ip_address||"").trim();
  if(wantedIp && session.ipAddress && wantedIp===String(session.ipAddress)) score+=20;

  if(session.isNewDeviceLogin) score+=6;

  const notificationTime=new Date(notification.created_at||"").getTime();
  const sessionTime=new Date(session.createdAt||"").getTime();
  if(Number.isFinite(notificationTime)&&Number.isFinite(sessionTime)){
    const minutes=Math.abs(notificationTime-sessionTime)/60000;
    if(minutes<=2)score+=10;
    else if(minutes<=10)score+=6;
    else if(minutes<=60)score+=2;
  }

  return score;
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
  const [page,setPage]=useState(1);
  const [sessionFlow,setSessionFlow]=useState(null);
  const [otpCode,setOtpCode]=useState("");
  const [sessionNotice,setSessionNotice]=useState("");

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

  useRealtimeRefresh("nova-realtime:notification", ()=>load({silent:true}));

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
    ...["Démarche","Service","Rendez-vous","Signalement","Message","Sécurité","Information"].map(type=>[type,type==="Sécurité"?copy.security:type]),
  ],[copy]);

  const visible=useMemo(()=>normalized.filter(item=>{
    if(filter==="Toutes")return true;
    if(filter==="Non lues")return !item.is_read;
    return item.notificationType===filter;
  }),[normalized,filter]);

  const perPage=8;
  const totalPages=Math.max(1,Math.ceil(visible.length/perPage));
  const pageItems=visible.slice((page-1)*perPage,page*perPage);
  useEffect(()=>{setPage(1)},[filter]);
  useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages]);

  const overview=useMemo(()=>({
    total:normalized.length,
    unread:normalized.filter(item=>!item.is_read).length,
    appointments:normalized.filter(item=>item.notificationType==="Rendez-vous").length,
    requests:normalized.filter(item=>["Démarche","Signalement"].includes(item.notificationType)).length,
  }),[normalized]);

  async function resolveSessionTarget(notification){
    let sessionId=notification.session_id||"";
    let securityEvents=[];

    if(!sessionId){
      try{
        const result=await getAccountSecurityEvents({page:1,page_size:100});
        securityEvents=result.results||[];

        const byId=notification.security_event_id
          ? securityEvents.find(event=>String(event.id)===String(notification.security_event_id))
          : null;

        if(byId?.sessionId)sessionId=byId.sessionId;

        if(!sessionId){
          const kind=String(notification.security_kind||"").toLowerCase();
          const createdAt=new Date(notification.created_at||"").getTime();

          const candidates=securityEvents
            .filter(event=>event.sessionId)
            .map(event=>{
              const eventTime=new Date(event.createdAt||"").getTime();
              let score=0;
              if(kind&&String(event.kind||"").toLowerCase()===kind)score+=12;
              if(Number.isFinite(createdAt)&&Number.isFinite(eventTime)){
                const minutes=Math.abs(createdAt-eventTime)/60000;
                if(minutes<=2)score+=10;
                else if(minutes<=10)score+=6;
              }
              return {event,score};
            })
            .filter(candidate=>candidate.score>=10)
            .sort((a,b)=>b.score-a.score);

          if(candidates.length===1 || (candidates[0]&&candidates[0].score>(candidates[1]?.score||0))){
            sessionId=candidates[0].event.sessionId;
          }
        }
      }catch{
        // Session resolution can still continue from the session list.
      }
    }

    const sessions=await getAccountSessions();

    if(sessionId){
      const exact=sessions.find(session=>String(session.id)===String(sessionId));
      return {session:exact||null,sessionId,sessions};
    }

    const scored=sessions
      .filter(isActiveSession)
      .map(session=>({session,score:securityCandidateScore(session,notification)}))
      .filter(candidate=>candidate.score>=20)
      .sort((a,b)=>b.score-a.score);

    if(scored.length===1 || (scored[0]&&scored[0].score>(scored[1]?.score||0))){
      return {session:scored[0].session,sessionId:scored[0].session.id,sessions};
    }

    return {session:null,sessionId:"",sessions};
  }

  async function openSessionRevocation(notification){
    setDetailLoading(true);
    setError("");
    setSessionNotice("");
    try{
      const resolved=await resolveSessionTarget(notification);
      const session=resolved.session;

      if(!session){
        setSessionNotice(copy.sessionMissing);
        setSessionFlow({
          phase:"unavailable",
          notification,
          session:null,
          sessionId:resolved.sessionId||notification.session_id||"",
        });
        return;
      }

      if(!isActiveSession(session)){
        setSessionNotice(copy.alreadyRevoked);
        setSessionFlow({
          phase:"unavailable",
          notification,
          session,
          sessionId:session.id,
        });
        return;
      }

      setOtpCode("");
      setSessionFlow({
        phase:session.isCurrent?"current":"confirm",
        notification,
        session,
        sessionId:session.id,
        challengeId:"",
        expiresIn:0,
      });
    }catch(err){
      setError(getApiErrorMessage(err,"Impossible de charger les sessions du compte."));
    }finally{
      setDetailLoading(false);
    }
  }

  async function openNotification(item){
    setDetailLoading(true);
    setError("");
    setSessionNotice("");
    try{
      let detail=await getCitizenNotification(item.id);
      const normalizedDetail={
        ...detail,
        notificationType:detail.category||"Information",
        typeMeta:metaFor(detail.category||"Information"),
      };

      setSelected(normalizedDetail);

      if(detail.is_session_security){
        setItems(rows=>rows.map(row=>String(row.id)===String(item.id)?{...row,...detail}:row));
        await openSessionRevocation(normalizedDetail);
        return;
      }

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

  async function beginSessionRevocation(){
    if(!sessionFlow?.session)return;

    if(sessionFlow.session.isCurrent){
      setBusy(true);setError("");
      try{
        await logoutCurrentAccountSession();
        clearAccessToken();
        invalidateSessionBootstrap();
        navigate("/login");
      }catch(err){
        setError(getApiErrorMessage(err,"Impossible de déconnecter cette session."));
      }finally{
        setBusy(false);
      }
      return;
    }

    setBusy(true);setError("");
    try{
      const result=await requestSessionRevocation({session_id:sessionFlow.session.id});
      setOtpCode("");
      setSessionFlow(current=>({
        ...current,
        phase:"otp",
        challengeId:result.emailChallengeId,
        expiresIn:result.expiresIn,
      }));
    }catch(err){
      setError(getApiErrorMessage(err,"Impossible d’envoyer le code de révocation."));
    }finally{
      setBusy(false);
    }
  }

  async function confirmSessionOtp(){
    if(!sessionFlow?.session||!sessionFlow.challengeId)return;

    setBusy(true);setError("");
    try{
      const result=await confirmSessionRevocation({
        emailChallengeId:sessionFlow.challengeId,
        emailCode:otpCode,
        session_id:sessionFlow.session.id,
      });

      if(result.revokedCount>0){
        try{
          await setNotificationRead(sessionFlow.notification.id,true);
        }catch{
          // The security action already succeeded. A read-state failure must not roll it back.
        }

        setItems(rows=>rows.map(row=>String(row.id)===String(sessionFlow.notification.id)?{...row,is_read:true}:row));
        setSelected(current=>current?{...current,is_read:true}:current);
        notifyNotificationStateChanged();

        await Promise.allSettled([
          getAccountSessions(),
          getAccountSecurityEvents({page:1,page_size:50}),
        ]);

        if(result.requiresRelogin){
          clearAccessToken();
          invalidateSessionBootstrap();
          navigate("/login");
          return;
        }

        setSessionFlow(current=>({...current,phase:"success"}));
        setSessionNotice(copy.revokedText);
      }else{
        setError("Aucune session n’a été révoquée. Actualisez les sessions puis réessayez.");
      }
    }catch(err){
      setError(getApiErrorMessage(err,"Le code n’a pas pu être validé."));
    }finally{
      setBusy(false);
    }
  }

  function closeSessionFlow(){
    if(busy)return;
    setSessionFlow(null);
    setOtpCode("");
  }


  function openTarget(item){
    const target=targetFor(item);
    if(target)navigate(target);
  }

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} actions={
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

          {pageItems.map(item=><button
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
                {item.is_session_security?<em className="notification-session-security">Session à vérifier</em>:null}
                <span className="notification-date"><NotificationIcon kind="calendar" size={13}/>{formatCreated(item.created_at,locale)}</span>
              </div>
            </div>
            <span className={`notification-arrow ${item.is_session_security?"is-security":""}`} aria-hidden="true">{item.is_session_security?"⌾":"→"}</span>
          </button>)}
          {!loading&&visible.length?<PortalPagination page={page} totalPages={totalPages} totalItems={visible.length} perPage={perPage} onPageChange={setPage} itemLabel="notification" itemLabelPlural="notifications"/>:null}
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
            {selected.is_session_security?
              <button className="primary-action notification-detail-revoke" type="button" onClick={()=>openSessionRevocation(selected)} disabled={busy||detailLoading}>
                <NotificationIcon kind="security" size={16}/>{copy.revoke}
              </button>
            :<>
              <button className="secondary-action" type="button" onClick={toggleSelectedRead} disabled={busy}>
                {selected.is_read?copy.markUnread:copy.markRead}
              </button>
              {targetFor(selected)?<button className="primary-action notification-detail-open" type="button" onClick={()=>openTarget(selected)}>{copy.open} →</button>:null}
            </>}
          </div>
        </aside>:detailLoading?<aside className="portal-card notification-detail-panel notification-detail-panel--loading"><div className="loading-card">Chargement…</div></aside>:null}
      </section>

      {sessionNotice?<div className="notification-session-notice" role="status">{sessionNotice}</div>:null}

      <PortalActionDialog
        open={Boolean(sessionFlow&&["confirm","current"].includes(sessionFlow.phase))}
        eyebrow={copy.security}
        title={sessionFlow?.phase==="current"?copy.currentTitle:copy.revokeTitle}
        description={sessionFlow?.phase==="current"?copy.currentText:copy.revokeText}
        icon="⌾"
        tone={sessionFlow?.phase==="current"?"danger":"default"}
        confirmLabel={sessionFlow?.phase==="current"?copy.currentConfirm:copy.sendCode}
        cancelLabel={copy.close}
        busy={busy}
        onClose={closeSessionFlow}
        onConfirm={beginSessionRevocation}
        details={sessionFlow?.session?[
          {label:copy.device,value:sessionFlow.session.device?.label||"Appareil inconnu"},
          {label:copy.ip,value:sessionFlow.session.ipAddress||"—"},
          {label:copy.lastSeen,value:sessionFlow.session.lastSeenLabel||"—"},
          {label:copy.sessionState,value:sessionFlow.session.isCurrent?"Cet appareil":sessionFlow.session.status||"active"},
        ]:[]}
      >
        {sessionFlow?.session?.isNewDeviceLogin?
          <p className="notification-session-warning">Nouvel appareil détecté pour cette session.</p>
        :null}
      </PortalActionDialog>

      <PortalActionDialog
        open={Boolean(sessionFlow?.phase==="otp")}
        eyebrow={copy.security}
        title={copy.otpTitle}
        description={copy.otpText}
        icon="✉"
        confirmLabel={copy.otpConfirm}
        cancelLabel={copy.close}
        busy={busy}
        confirmDisabled={!/^[0-9]{4,8}$/.test(otpCode.trim())}
        onClose={closeSessionFlow}
        onConfirm={confirmSessionOtp}
        details={sessionFlow?.session?[
          {label:copy.device,value:sessionFlow.session.device?.label||"Appareil inconnu"},
          {label:copy.ip,value:sessionFlow.session.ipAddress||"—"},
          {label:"Expiration",value:sessionFlow.expiresIn?`${Math.ceil(sessionFlow.expiresIn/60)} min`:"—"},
        ]:[]}
      >
        <div className="portal-action-dialog__fields">
          <label className="full">
            <span>{copy.otpLabel}</span>
            <input
              className="notification-session-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength="8"
              value={otpCode}
              onChange={event=>setOtpCode(event.target.value.replace(/\D/g,"").slice(0,8))}
              placeholder={copy.otpPlaceholder}
              autoFocus
            />
          </label>
        </div>
      </PortalActionDialog>

      <PortalActionDialog
        open={Boolean(sessionFlow?.phase==="success")}
        eyebrow={copy.security}
        title={copy.revoked}
        description={copy.revokedText}
        icon="✓"
        tone="success"
        confirmLabel={copy.close}
        cancelLabel={copy.close}
        onClose={closeSessionFlow}
        onConfirm={closeSessionFlow}
        details={sessionFlow?.session?[
          {label:copy.device,value:sessionFlow.session.device?.label||"Appareil inconnu"},
          {label:copy.ip,value:sessionFlow.session.ipAddress||"—"},
          {label:copy.sessionState,value:copy.revoked},
        ]:[]}
      />

      <PortalActionDialog
        open={Boolean(sessionFlow?.phase==="unavailable")}
        eyebrow={copy.security}
        title={sessionFlow?.session?copy.alreadyRevoked:copy.sessionMissing}
        description={sessionFlow?.session?"Cette notification reste disponible comme trace de sécurité.":"Aucune révocation automatique n’est lancée afin d’éviter de déconnecter le mauvais appareil."}
        icon="i"
        confirmLabel={copy.close}
        cancelLabel={copy.close}
        onClose={closeSessionFlow}
        onConfirm={closeSessionFlow}
        details={sessionFlow?.session?[
          {label:copy.device,value:sessionFlow.session.device?.label||"Appareil inconnu"},
          {label:copy.ip,value:sessionFlow.session.ipAddress||"—"},
          {label:copy.sessionState,value:sessionFlow.session.status||"—"},
        ]:[]}
      />
    </main>
  </div></div>;
}

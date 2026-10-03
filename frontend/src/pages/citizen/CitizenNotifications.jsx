import { useEffect, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getCitizenNotifications, markAllNotificationsRead, setNotificationRead } from "../../api/notifications.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const COPY={
  fr:{eyebrow:"Centre de notifications",title:"Notifications",all:"Tout marquer comme lu",loading:"Chargement…",empty:"Aucune notification.",error:"Impossible de charger les notifications.",info:"Information"},
  en:{eyebrow:"Notification center",title:"Notifications",all:"Mark all as read",loading:"Loading…",empty:"No notifications.",error:"Unable to load notifications.",info:"Information"},
  mg:{eyebrow:"Foiben'ny fampahafantarana",title:"Fampahafantarana",all:"Mariho ho voavaky rehetra",loading:"Mampiditra…",empty:"Tsy misy fampahafantarana.",error:"Tsy afaka mampiseho ny fampahafantarana.",info:"Vaovao"}
};

export default function CitizenNotifications(){
  const [locale]=useLocale(); const copy=COPY[locale]||COPY.fr;
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    let active=true;
    setLoading(true);
    getCitizenNotifications().then(data=>active&&setItems(data)).catch(e=>active&&setError(getApiErrorMessage(e,copy.error))).finally(()=>active&&setLoading(false));
    return()=>{active=false};
  },[locale]);

  async function read(item){
    try{
      const next=await setNotificationRead(item.id,true);
      setItems(rows=>rows.map(row=>row.id===item.id?next:row));
      if(next.request_reference)navigate(`/citizen/requests/${encodeURIComponent(next.request_reference)}`);
      else if(next.contact_reference)navigate(`/citizen/messages/${encodeURIComponent(next.contact_reference)}`);
    }catch(e){setError(getApiErrorMessage(e))}
  }

  async function readAll(){
    setBusy(true);
    try{await markAllNotificationsRead();setItems(rows=>rows.map(row=>({...row,is_read:true})))}
    catch(e){setError(getApiErrorMessage(e))}
    finally{setBusy(false)}
  }

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow={copy.eyebrow} title={copy.title} actions={<button className="topbar-ghost" onClick={readAll} disabled={busy}>{copy.all}</button>}/>
    <main className="portal-content">
      {error?<div className="error-card" role="alert">{error}</div>:null}
      <section className="portal-card notification-list">
        {loading?<div className="loading-card">{copy.loading}</div>:items.map(n=><button key={n.id} className={!n.is_read?"is-unread":""} onClick={()=>read(n)}>
          <i aria-hidden="true">{!n.is_read?"●":"○"}</i>
          <div><strong>{n.title}</strong><span>{n.createdLabel}</span></div>
          <em>{n.message||n.type||copy.info}</em>
        </button>)}
        {!loading&&!items.length?<div className="empty-inline">{copy.empty}</div>:null}
      </section>
    </main>
  </div></div>;
}

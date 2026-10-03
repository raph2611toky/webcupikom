import { useEffect, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getCitizenNotifications, markAllNotificationsRead, setNotificationRead } from "../../api/notifications.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function CitizenNotifications(){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function load(){
    setLoading(true);setError("");
    try{setItems(await getCitizenNotifications())}
    catch(e){setError(getApiErrorMessage(e,"Impossible de charger les notifications."))}
    finally{setLoading(false)}
  }

  useEffect(()=>{load()},[]);

  async function toggle(item){
    try{
      const next=await setNotificationRead(item.id,!item.is_read);
      setItems(current=>current.map(x=>x.id===item.id?next:x));
      if(next.request_reference)navigate(`/citizen/requests/${encodeURIComponent(next.request_reference)}`);
      else if(next.contact_reference)navigate(`/citizen/messages/${encodeURIComponent(next.contact_reference)}`);
    }catch(e){setError(getApiErrorMessage(e))}
  }

  async function readAll(){
    setBusy(true);
    try{await markAllNotificationsRead();setItems(current=>current.map(x=>({...x,is_read:true})))}
    catch(e){setError(getApiErrorMessage(e))}
    finally{setBusy(false)}
  }

  const unread=items.filter(x=>!x.is_read).length;

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow="Centre de notifications" title="Notifications" actions={unread?<button className="topbar-cta" disabled={busy} onClick={readAll}>Tout marquer comme lu</button>:null}/>
      <main className="portal-content">
        {error?<div className="error-card" role="alert">{error}</div>:null}
        <section className="portal-card notification-list">
          {loading?<div className="loading-card">Chargement…</div>:
          items.length?items.map(item=><button key={item.id} className={item.is_read?"":"is-unread"} onClick={()=>toggle(item)}>
            <i aria-hidden="true">●</i>
            <div><strong>{item.title}</strong><span>{item.message||"Notification Nova Terra"}</span></div>
            <em>{item.createdLabel}</em>
          </button>):<div className="empty-state"><h2>Aucune notification</h2><p>Les nouvelles informations liées à vos démarches apparaîtront ici.</p></div>}
        </section>
      </main>
    </div>
  </div>;
}

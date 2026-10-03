import { useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { notifications as source } from "../../data/mockData.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function CitizenNotifications(){const [items,setItems]=useState(source);return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow="Centre de notifications" title="Notifications" actions={<button className="topbar-ghost" onClick={()=>setItems(items.map(i=>({...i,unread:false})))}>Tout marquer comme lu</button>}/><main className="portal-content"><section className="portal-card notification-list">{items.map(n=><button key={n.id} className={n.unread?'is-unread':''} onClick={()=>setItems(items.map(i=>i.id===n.id?{...i,unread:false}:i))}><i>{n.unread?'●':'○'}</i><div><strong>{n.title}</strong><span>{n.time}</span></div><em>{n.type}</em></button>)}</section></main></div></div>}

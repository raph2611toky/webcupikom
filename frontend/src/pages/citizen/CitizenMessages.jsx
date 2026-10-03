import { useEffect, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getCitizenContactMessages } from "../../api/contact.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function CitizenMessages(){
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{let mounted=true;getCitizenContactMessages().then(data=>mounted&&setItems(data)).catch(e=>mounted&&setError(getApiErrorMessage(e,"Impossible de charger vos messages."))).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[]);
  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow="Relations citoyennes" title="Mes messages" actions={<button className="topbar-cta" onClick={()=>navigate('/contact')}>Nouveau message</button>}/><main className="portal-content">{error?<div className="error-card">{error}</div>:null}<section className="portal-card">{loading?<div className="loading-card">Chargement…</div>:<div className="portal-table portal-table--messages"><div className="portal-table__head"><span>Référence</span><span>Sujet</span><span>Service</span><span>Statut</span><span>Date</span><span/></div>{items.map(item=><button className="portal-table__row" key={item.reference} onClick={()=>navigate(`/citizen/messages/${encodeURIComponent(item.reference)}`)}><span className="mono">{item.reference}</span><strong>{item.subject}</strong><span>{item.service_name||'Mairie'}</span><span><em className={`status-pill status-${item.statusCode}`}>{item.statusLabel}</em></span><span>{item.createdLabel}</span><span>→</span></button>)}{!items.length?<p className="detail-copy">Vous n’avez encore envoyé aucun message.</p>:null}</div>}</section></main></div></div>;
}

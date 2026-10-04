import { useEffect, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getCitizenContactMessage } from "../../api/contact.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";

export default function CitizenMessageDetails({params}){
 const [item,setItem]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let mounted=true;getCitizenContactMessage(params.id).then(data=>mounted&&setItem(data)).catch(e=>mounted&&setError(getApiErrorMessage(e,"Message introuvable."))).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[params.id]);
 return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow="Relations citoyennes" title={item?.reference||"Message"}/><main className="portal-content"><button className="back-link" onClick={()=>navigate('/citizen/messages')}>← Retour aux messages</button>{loading?<div className="loading-card">Chargement…</div>:error?<div className="error-card">{error}</div>:item?<section className="portal-grid portal-grid--2"><article className="portal-card"><span className="section-label">Message</span><h3>{item.subject}</h3><p className="detail-copy">{item.message}</p></article><article className="portal-card"><span className="section-label">Suivi</span><h3>{item.statusLabel}</h3><div className="detail-list"><div><span>Service</span><b>{item.service_name||'Mairie'}</b></div><div><span>Envoyé</span><b>{item.createdLabel}</b></div><div><span>Mise à jour</span><b>{item.updatedLabel}</b></div></div></article></section>:null}</main></div></div>;
}

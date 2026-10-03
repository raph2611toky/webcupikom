import { useEffect, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getCitizenRequest } from "../../api/requests.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function CitizenRequestDetails({params}){
 const [request,setRequest]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let mounted=true;getCitizenRequest(params.id).then(data=>mounted&&setRequest(data)).catch(e=>mounted&&setError(getApiErrorMessage(e,"Demande introuvable."))).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[params.id]);
 if(loading)return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow="Suivi de demande" title="Chargement"/><main className="portal-content"><div className="loading-card">Chargement de la demande…</div></main></div></div>;
 if(error||!request)return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow="Suivi de demande" title="Demande"/><main className="portal-content"><div className="error-card">{error||"Demande introuvable."}</div></main></div></div>;
 const done=request.statusCode==="completed";
 const progressing=["in_progress","action_required","completed"].includes(request.statusCode);
 return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow="Suivi de demande" title={request.id}/><main className="portal-content">
   <button className="back-link" onClick={()=>navigate('/citizen/requests')}>← Retour à mes demandes</button>
   <section className="request-detail-hero"><div><span>{request.service}</span><h2>{request.title}</h2><p>{request.description}</p></div><em className={`status-pill status-${request.status.replaceAll(' ','-').toLowerCase()}`}>{request.status}</em></section>
   <section className="portal-grid portal-grid--detail"><article className="portal-card"><span className="section-label">Suivi</span><h3>Avancement de la demande</h3><div className="timeline"><div className="done"><i>✓</i><div><b>Demande envoyée</b><span>{request.created}</span></div></div><div className="done"><i>✓</i><div><b>Demande reçue</b><span>{request.created}</span></div></div><div className={progressing&&!done?"current":progressing?"done":""}><i>{progressing?'●':'○'}</i><div><b>En traitement</b><span>{progressing?request.updated:"Étape suivante"}</span></div></div><div className={done?"done":""}><i>{done?'✓':'○'}</i><div><b>Terminée</b><span>{done?request.updated:"Étape suivante"}</span></div></div></div></article>
   <article className="portal-card"><span className="section-label">Informations</span><h3>Détails</h3><div className="detail-list"><div><span>Service</span><b>{request.service}</b></div><div><span>Priorité</span><b>{request.priority}</b></div><div><span>Créée</span><b>{request.created}</b></div><div><span>Dernière mise à jour</span><b>{request.updated}</b></div></div><hr/><span className="section-label">Description</span><p className="detail-copy">{request.description}</p></article>
   <article className="portal-card portal-card--wide"><div className="portal-card__head"><div><span className="section-label">Documents</span><h3>Pièces jointes</h3></div></div><p className="detail-copy">Aucune pièce jointe exposée par l’API actuelle.</p></article>
   <article className="action-bar portal-card--wide"><div><b>Besoin d’une précision ?</b><span>Contactez directement le service municipal concerné.</span></div><div><button className="primary-action" onClick={()=>navigate('/contact')}>Contacter le service</button></div></article>
   </section>
 </main></div></div>;
}

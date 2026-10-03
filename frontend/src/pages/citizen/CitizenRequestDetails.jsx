import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { citizenRequests } from "../../data/mockData.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function CitizenRequestDetails({params}){
 const request=citizenRequests.find(r=>r.id===params.id)||citizenRequests[0];
 return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow="Suivi de demande" title={request.id}/><main className="portal-content">
   <button className="back-link" onClick={()=>navigate('/citizen/requests')}>← Retour à mes demandes</button>
   <section className="request-detail-hero"><div><span>{request.service}</span><h2>{request.title}</h2><p>{request.description}</p></div><em className={`status-pill status-${request.status.replaceAll(' ','-').toLowerCase()}`}>{request.status}</em></section>
   <section className="portal-grid portal-grid--detail"><article className="portal-card"><span className="section-label">Suivi</span><h3>Avancement de la demande</h3><div className="timeline"><div className="done"><i>✓</i><div><b>Demande envoyée</b><span>03 octobre · 08:30</span></div></div><div className="done"><i>✓</i><div><b>Demande reçue</b><span>03 octobre · 08:31</span></div></div><div className="current"><i>●</i><div><b>En traitement</b><span>03 octobre · 09:15</span></div></div><div><i>○</i><div><b>Intervention</b><span>Étape suivante</span></div></div></div></article>
   <article className="portal-card"><span className="section-label">Informations</span><h3>Détails</h3><div className="detail-list"><div><span>Service</span><b>{request.service}</b></div><div><span>Quartier</span><b>{request.district}</b></div><div><span>Créée</span><b>{request.created}</b></div><div><span>Dernière mise à jour</span><b>{request.updated}</b></div></div><hr/><span className="section-label">Description</span><p className="detail-copy">{request.description}</p></article>
   <article className="portal-card portal-card--wide"><div className="portal-card__head"><div><span className="section-label">Documents</span><h3>Pièces jointes</h3></div><button>+ Ajouter</button></div><div className="document-row"><i>PDF</i><div><b>photo_signalement.pdf</b><span>1.8 Mo · ajouté le 03 octobre</span></div><button>Voir</button></div></article>
   <article className="action-bar portal-card--wide"><div><b>Une précision à ajouter ?</b><span>Complétez votre dossier ou contactez directement le service.</span></div><div><button className="secondary-action">Ajouter une information</button><button className="primary-action" onClick={()=>navigate('/contact')}>Contacter le service</button></div></article>
   </section>
 </main></div></div>;
}

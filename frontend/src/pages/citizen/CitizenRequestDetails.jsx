import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getCitizenRequest } from "../../api/requests.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { getLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

function buildTimeline(request, locale) {
  const code = request?.statusCode;
  const created = request?.created;
  const updated = request?.updated;
  const processing = ["in_progress", "action_required", "completed"].includes(code);
  const completed = code === "completed";

  const labels = locale === "en"
    ? ["Request sent", "Received by the city", "Taken in charge", "In progress", "Resolved"]
    : ["Demande envoyée", "Demande reçue par la ville", "Prise en charge", "Traitement en cours", "Résolue"];

  return [
    { label: labels[0], state: "done", at: created },
    { label: labels[1], state: "done", at: created },
    { label: labels[2], state: processing ? "done" : "next", at: processing ? updated : null },
    { label: labels[3], state: processing ? (completed ? "done" : "current") : "next", at: processing ? updated : null },
    { label: labels[4], state: completed ? "done" : "next", at: completed ? updated : null },
  ];
}

function citizenStatus(status, locale) {
  if (locale !== "en") return status;
  return ({
    "Envoyée": "Sent",
    "En attente": "Pending",
    "En traitement": "In progress",
    "Action requise": "Action required",
    "Terminée": "Completed",
  })[status] || status;
}

export default function CitizenRequestDetails({params}){
  const { user } = useAuth();
  const locale = user?.locale || getLocale();
  const [request,setRequest]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let mounted=true;
    getCitizenRequest(params.id)
      .then(data=>mounted&&setRequest(data))
      .catch(e=>mounted&&setError(getApiErrorMessage(e, locale==="en" ? "Request not found." : "Demande introuvable.")))
      .finally(()=>mounted&&setLoading(false));
    return()=>{mounted=false};
  },[params.id, locale]);

  const timeline = useMemo(()=>buildTimeline(request, locale),[request, locale]);

  if(loading) return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow={locale==="en"?"Request tracking":"Suivi de demande"} title={locale==="en"?"Loading":"Chargement"}/><main className="portal-content"><div className="loading-card">{locale==="en"?"Loading request…":"Chargement de la demande…"}</div></main></div></div>;
  if(error||!request) return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow={locale==="en"?"Request tracking":"Suivi de demande"} title={locale==="en"?"Request":"Demande"}/><main className="portal-content"><div className="error-card">{error||(locale==="en"?"Request not found.":"Demande introuvable.")}</div></main></div></div>;

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow={locale==="en"?"Request tracking":"Suivi de demande"} title={request.id}/>
      <main className="portal-content">
        <button className="back-link" onClick={()=>navigate("/citizen/requests")}>← {locale==="en"?"Back to my requests":"Retour à mes demandes"}</button>

        <section className="request-detail-hero">
          <div><span>{request.service}</span><h2>{request.title}</h2><p>{request.description}</p></div>
          <em className={`status-pill status-${String(request.status).replaceAll(" ","-").toLowerCase()}`}>{citizenStatus(request.status, locale)}</em>
        </section>

        <section className="portal-grid portal-grid--detail">
          <article className="portal-card">
            <span className="section-label">{locale==="en"?"TRACKING":"SUIVI"}</span>
            <h3>{locale==="en"?"Request progress":"Avancement de la demande"}</h3>
            <div className="timeline">
              {timeline.map((item)=><div key={item.label} className={item.state}>
                <i aria-hidden="true">{item.state==="done"?"✓":item.state==="current"?"●":"○"}</i>
                <div><b>{item.label}</b><span>{item.at || (locale==="en"?"Next step":"Étape suivante")}</span></div>
              </div>)}
            </div>
          </article>

          <article className="portal-card">
            <span className="section-label">{locale==="en"?"INFORMATION":"INFORMATIONS"}</span>
            <h3>{locale==="en"?"Details":"Détails"}</h3>
            <div className="detail-list">
              <div><span>{locale==="en"?"Service":"Service"}</span><b>{request.service}</b></div>
              <div><span>{locale==="en"?"Priority":"Priorité"}</span><b>{request.priority}</b></div>
              <div><span>{locale==="en"?"Created":"Créée"}</span><b>{request.created}</b></div>
              <div><span>{locale==="en"?"Last update":"Dernière mise à jour"}</span><b>{request.updated}</b></div>
            </div>
          </article>

          <article className="portal-card portal-card--wide">
            <span className="section-label">{locale==="en"?"NEED HELP?":"BESOIN D’AIDE ?"}</span>
            <h3>{locale==="en"?"A question about this request":"Une question sur cette démarche"}</h3>
            <p className="detail-copy">{locale==="en"?"Send another request or open the citizen assistant without leaving your space.":"Vous pouvez transmettre une nouvelle demande ou ouvrir l’assistant sans quitter votre espace."}</p>
            <div className="action-buttons">
              <button className="secondary-action" onClick={()=>window.dispatchEvent(new CustomEvent("nova-help"))}>{locale==="en"?"Open assistant":"Ouvrir l’assistant"}</button>
              <button className="primary-action" onClick={()=>navigate("/citizen/requests?new=1")}>{locale==="en"?"New request":"Nouvelle demande"}</button>
            </div>
          </article>
        </section>
      </main>
    </div>
  </div>;
}

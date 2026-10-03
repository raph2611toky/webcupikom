import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getMunicipalProjects } from "../../api/projects.js";
import { getApiErrorMessage } from "../../api/auth.js";
import "../../styles/app-shell.css";
import "../../styles/pages/projects.css";

const STATUS={planned:"Planifié",in_progress:"En cours",paused:"En pause",completed:"Terminé",cancelled:"Annulé"};

export default function AgentProjects(){
  const [projects,setProjects]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let active=true;
    getMunicipalProjects({force:true})
      .then(rows=>active&&setProjects(rows))
      .catch(e=>active&&setError(getApiErrorMessage(e,"Impossible de charger les projets municipaux.")))
      .finally(()=>active&&setLoading(false));
    return()=>{active=false};
  },[]);

  const stats=useMemo(()=>({
    active:projects.filter(p=>!["completed","cancelled"].includes(p.status)).length,
    consultations:projects.filter(p=>p.participation_type==="consultation"&&p.participationIsOpen).length,
    decisions:projects.filter(p=>p.participation_type==="decision"&&p.participationIsOpen).length,
    supports:projects.reduce((sum,p)=>sum+Number(p.supportCount||0),0),
  }),[projects]);

  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Participation citoyenne" title="Projets municipaux"/>
    <main className="portal-content agent-projects-page">
      {error?<div className="error-card" role="alert">{error}</div>:null}
      <section className="project-agent-note portal-card"><div><strong>Vue agent en lecture seule</strong><p>Les projets affichés sont les projets publiés par Nova Terra. La création, la publication et le traitement des idées sont gérés dans l’espace Administration.</p></div><span>Backend connecté</span></section>
      <section className="metric-grid metric-grid--4"><article><span>Actifs</span><strong>{stats.active}</strong><small>projets publiés</small></article><article><span>Consultations</span><strong>{stats.consultations}</strong><small>ouvertes</small></article><article><span>Décisions</span><strong>{stats.decisions}</strong><small>ouvertes</small></article><article><span>Soutiens</span><strong>{stats.supports}</strong><small>citoyens</small></article></section>
      <section className="portal-card agent-project-list"><div className="portal-card__head"><div><h3>Projets visibles par les citoyens</h3></div></div>{loading?<div className="loading-card">Chargement…</div>:projects.map(project=><article key={project.id||project.slug} className="agent-project-row"><div><span className={`project-status status-${project.status}`}>{project.statusLabel||STATUS[project.status]||project.status}</span><h4>{project.title}</h4><p>{project.district||"Nova Terra"} · {project.progress}% · {project.participation_type==="none"?"Information":project.participation_type==="decision"?"Décision citoyenne":"Consultation"}</p></div><div className="agent-project-row__numbers"><span><b>{project.participationCount||0}</b> participations</span><span><b>{project.ideaCount||0}</b> idées</span></div></article>)}{!loading&&!projects.length?<p className="detail-copy">Aucun projet publié actuellement.</p>:null}</section>
    </main>
  </div></div>;
}

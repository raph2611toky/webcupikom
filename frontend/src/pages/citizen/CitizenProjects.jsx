import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getCitizenIdeas, getMunicipalProjects, submitCitizenIdea } from "../../api/projects.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/projects.css";

const STATUS = {
  planned: "Planifié",
  in_progress: "En cours",
  consultation: "Consultation",
  completed: "Terminé",
};
const FILTERS = [["all","Tous"],["in_progress","En cours"],["consultation","Consultation"],["completed","Terminés"]];
const DISTRICTS = ["Nova Centre","District Orion","Quartier Aster","Pôle Hélios","Rives d’Azura","Jardins Lyra"];
const CATEGORIES = ["Mobilité","Environnement","Santé","Cadre de vie","Numérique","Culture","Autre"];

function formatMonth(value){
  if(!value)return "—";
  const date=new Date(`${value}T12:00:00`);
  if(Number.isNaN(date.getTime()))return value;
  return new Intl.DateTimeFormat("fr-FR",{month:"long",year:"numeric"}).format(date);
}

export default function CitizenProjects(){
  const {user}=useAuth();
  const [projects,setProjects]=useState([]);
  const [filter,setFilter]=useState("all");
  const [ideaOpen,setIdeaOpen]=useState(false);
  const [ideas,setIdeas]=useState([]);
  const [idea,setIdea]=useState({title:"",category:"Mobilité",district:"Nova Centre",description:""});
  const [receipt,setReceipt]=useState(null);
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);

  async function load(){
    const [projectRows,ideaRows]=await Promise.all([getMunicipalProjects(),getCitizenIdeas(user)]);
    setProjects(projectRows);setIdeas(ideaRows);
  }
  useEffect(()=>{load().catch(()=>setError("Impossible de charger les projets municipaux."))},[user?.id,user?.email]);

  const visible=useMemo(()=>projects.filter(project=>filter==="all"||project.status===filter||filter==="consultation"&&project.participation_type!=="none"),[projects,filter]);

  async function submitIdea(event){
    event.preventDefault();
    if(!idea.title.trim()||!idea.description.trim()){setError("Ajoutez un titre et décrivez votre proposition.");return}
    setSaving(true);setError("");
    try{
      const created=await submitCitizenIdea(user,idea);
      setReceipt(created);setIdea({title:"",category:"Mobilité",district:"Nova Centre",description:""});setIdeaOpen(false);await load();
    }catch{setError("Impossible d’enregistrer la proposition.")}
    finally{setSaving(false)}
  }

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Participation citoyenne" title="Projets municipaux" actions={<button className="primary-action" onClick={()=>setIdeaOpen(true)}>+ Proposer une idée</button>}/>
    <main className="portal-content projects-page">
      {error?<div className="error-card" role="alert">{error}</div>:null}
      {receipt?<div className="project-receipt" role="status"><strong>✓ Proposition envoyée</strong><span>Votre idée a bien été enregistrée.</span><b>Référence : {receipt.reference}</b></div>:null}

      <section className="projects-hero portal-card">
        <div><span className="section-label">F67 · F66 · F65 · F68</span><h2>Découvrez les projets en cours à Nova Terra et participez à leur évolution.</h2><p>Consultez l’avancement, donnez votre avis lorsqu’une consultation est ouverte et retrouvez une trace claire de vos contributions.</p></div>
        <div className="projects-hero__stats"><div><strong>{projects.filter(p=>p.status!=="completed").length}</strong><span>projets actifs</span></div><div><strong>{projects.filter(p=>p.participation_type!=="none").length}</strong><span>participations ouvertes</span></div><div><strong>{ideas.length}</strong><span>idées proposées</span></div></div>
      </section>

      <div className="project-filter-row" role="toolbar" aria-label="Filtrer les projets">{FILTERS.map(([value,label])=><button type="button" key={value} className={filter===value?"is-active":""} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>

      <section className="project-grid" aria-label="Liste des projets municipaux">
        {visible.map(project=><article className="project-card" key={project.id}>
          <div className="project-card__top"><span className={`project-status status-${project.status}`}>{STATUS[project.status]||project.status}</span>{project.participation_type!=="none"?<span className="project-participation-badge">{project.participation_type==="decision"?"Décision citoyenne":"Consultation"}</span>:null}</div>
          <div className="project-card__icon" aria-hidden="true">{project.participation_type==="decision"?"◎":project.district.includes("Aster")?"✚":"✦"}</div>
          <h3>{project.title}</h3><p>{project.summary}</p>
          <div className="project-progress"><div><span>Progression</span><b>{project.progress}%</b></div><progress value={project.progress} max="100">{project.progress}%</progress></div>
          <dl><div><dt>Calendrier</dt><dd>{formatMonth(project.start_date)} → {formatMonth(project.expected_end_date)}</dd></div><div><dt>Quartier</dt><dd>{project.district}</dd></div></dl>
          <button className="secondary-action" type="button" onClick={()=>navigate(`/citizen/projects/${project.slug}`)}>Voir le projet →</button>
        </article>)}
      </section>

      <section className="idea-callout portal-card"><div><span className="section-label">F68</span><h3>Une idée pour Nova Terra ?</h3><p>Proposez une amélioration pour votre quartier ou pour l’ensemble de la ville. Une référence vous sera donnée immédiatement.</p></div><button className="primary-action" onClick={()=>setIdeaOpen(true)}>+ Proposer une idée</button></section>

      {ideas.length?<section className="portal-card citizen-ideas-history"><div className="portal-card__head"><div><span className="section-label">Mes contributions</span><h3>Mes idées proposées</h3></div></div><div className="citizen-ideas-history__list">{ideas.slice(0,5).map(item=><div key={item.id}><div><strong>{item.title}</strong><span>{item.category} · {item.district}</span></div><b>{item.reference}</b></div>)}</div></section>:null}

      {ideaOpen?<div className="project-modal-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)setIdeaOpen(false)}}><section className="project-modal" role="dialog" aria-modal="true" aria-labelledby="idea-title"><div className="project-modal__head"><div><span className="section-label">F68 · Contribution citoyenne</span><h3 id="idea-title">Proposer une idée</h3></div><button type="button" aria-label="Fermer" onClick={()=>setIdeaOpen(false)}>×</button></div><form onSubmit={submitIdea} className="project-form">
        <label><span>Titre</span><input value={idea.title} onChange={e=>setIdea(v=>({...v,title:e.target.value}))} placeholder="Ex. Installer des bancs au Jardin Lyra" required/></label>
        <div className="project-form__row"><label><span>Catégorie</span><select value={idea.category} onChange={e=>setIdea(v=>({...v,category:e.target.value}))}>{CATEGORIES.map(v=><option key={v}>{v}</option>)}</select></label><label><span>Quartier</span><select value={idea.district} onChange={e=>setIdea(v=>({...v,district:e.target.value}))}>{DISTRICTS.map(v=><option key={v}>{v}</option>)}</select></label></div>
        <label><span>Votre proposition</span><textarea value={idea.description} onChange={e=>setIdea(v=>({...v,description:e.target.value}))} placeholder="Expliquez simplement le besoin et l’amélioration proposée…" required/></label>
        <div className="project-form__actions"><button type="button" className="secondary-action" onClick={()=>setIdeaOpen(false)}>Annuler</button><button type="submit" className="primary-action" disabled={saving}>{saving?"Envoi…":"Envoyer ma proposition"}</button></div>
      </form></section></div>:null}
    </main>
  </div></div>;
}

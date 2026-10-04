import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import PortalPagination from "../../components/ui/PortalPagination.jsx";
import { getCitizenIdeas, getMunicipalProjects, submitCitizenIdea } from "../../api/projects.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { navigate } from "../../utils/navigation.js";

const STATUS = {
  planned: "Planifié",
  in_progress: "En cours",
  paused: "En pause",
  completed: "Terminé",
  cancelled: "Annulé",
};
const FILTERS = [["all","Tous"],["in_progress","En cours"],["participation","Participation ouverte"],["completed","Terminés"]];
const DISTRICTS = ["Nova Centre","District Orion","Quartier Aster","Pôle Hélios","Rives d’Azura","Jardins Lyra"];
const CATEGORIES = ["Mobilité","Environnement","Santé","Cadre de vie","Numérique","Culture","Autre"];

function formatMonth(value){
  if(!value)return "—";
  const date=new Date(`${value}T12:00:00`);
  if(Number.isNaN(date.getTime()))return value;
  return new Intl.DateTimeFormat("fr-FR",{month:"short",year:"numeric"}).format(date);
}

export default function CitizenProjects(){
  const {user}=useAuth();
  const [projects,setProjects]=useState([]);
  const [filter,setFilter]=useState("all");
  const [page,setPage]=useState(1);
  const [ideaOpen,setIdeaOpen]=useState(false);
  const [ideasOpen,setIdeasOpen]=useState(false);
  const [ideas,setIdeas]=useState([]);
  const [idea,setIdea]=useState({title:"",category:"Mobilité",district:"Nova Centre",description:"",project_slug:""});
  const [receipt,setReceipt]=useState(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);

  async function load(){
    setLoading(true);setError("");
    try{
      const [projectRows,ideaRows]=await Promise.all([getMunicipalProjects({force:true}),getCitizenIdeas()]);
      setProjects(projectRows);setIdeas(ideaRows);
    }catch(e){setError(getApiErrorMessage(e,"Impossible de charger les projets municipaux."))}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[user?.id,user?.email]);

  const visible=useMemo(()=>projects.filter(project=>{
    if(filter==="all")return true;
    if(filter==="participation")return project.participation_type!=="none"&&project.participationIsOpen;
    return project.status===filter;
  }),[projects,filter]);

  const perPage=6;
  const totalPages=Math.max(1,Math.ceil(visible.length/perPage));
  const paginatedProjects=visible.slice((page-1)*perPage,page*perPage);
  useEffect(()=>{setPage(1)},[filter]);
  useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages]);

  async function submitIdea(event){
    event.preventDefault();
    if(!idea.title.trim()||!idea.description.trim()){setError("Ajoutez un titre et décrivez votre proposition.");return}
    setSaving(true);setError("");
    try{
      const created=await submitCitizenIdea(user,idea);
      setReceipt(created);
      setIdea({title:"",category:"Mobilité",district:"Nova Centre",description:"",project_slug:""});
      setIdeaOpen(false);
      setIdeas(await getCitizenIdeas());
    }catch(e){setError(getApiErrorMessage(e,"Impossible d’enregistrer la proposition."))}
    finally{setSaving(false)}
  }

  const activeProjects=projects.filter(p=>!["completed","cancelled"].includes(p.status)).length;
  const openParticipations=projects.filter(p=>p.participation_type!=="none"&&p.participationIsOpen).length;

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Participation citoyenne" title="Projets municipaux" actions={<>
      <button className="topbar-ghost" onClick={()=>setIdeasOpen(true)}>Mes idées{ideas.length?` (${ideas.length})`:""}</button>
      <button className="topbar-cta" onClick={()=>setIdeaOpen(true)}>+ Proposer une idée</button>
    </>}/>
    <main className="portal-content projects-page projects-page--compact">
      {error?<div className="error-card" role="alert">{error}</div>:null}
      {receipt?<div className="project-receipt project-receipt--compact" role="status"><strong>✓ Proposition envoyée</strong><span>{receipt.confirmation||"Votre idée a bien été enregistrée."}</span><b>{receipt.reference?`Réf. ${receipt.reference}`:""}</b></div>:null}

      <section className="project-toolbar" aria-label="Filtres des projets">
        <div className="project-filter-row" role="toolbar" aria-label="Filtrer les projets">{FILTERS.map(([value,label])=><button type="button" key={value} className={filter===value?"is-active":""} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
        <div className="project-mini-stats" aria-label="Résumé"><span><b>{activeProjects}</b> actifs</span><span><b>{openParticipations}</b> participations</span></div>
      </section>

      {loading?<div className="loading-card project-loading-card">Chargement des projets…</div>:null}
      {!loading&&!visible.length?<section className="portal-card project-empty-state"><i aria-hidden="true">✦</i><strong>Aucun projet dans cette catégorie</strong><span>Les projets publiés par l’administration apparaîtront ici.</span></section>:null}

      <section className="project-grid project-grid--compact" aria-label="Liste des projets municipaux">
        {paginatedProjects.map(project=><article className="project-card project-card--compact" key={project.id||project.slug}>
          <div className="project-card__top"><span className={`project-status status-${project.status}`}>{project.statusLabel||STATUS[project.status]||project.status}</span>{project.participation_type!=="none"?<span className="project-participation-badge">{project.participation_type==="decision"?"Décision":"Consultation"}</span>:null}</div>
          <div className="project-card__title-row"><div className="project-card__icon" aria-hidden="true">{project.participation_type==="decision"?"◎":project.district.includes("Aster")?"✚":"✦"}</div><div><h3>{project.title}</h3><p>{project.summary||project.description}</p></div></div>
          <div className="project-progress"><div><span>Progression</span><b>{project.progress}%</b></div><progress value={project.progress} max="100">{project.progress}%</progress></div>
          <dl><div><dt>Dates</dt><dd>{formatMonth(project.start_date)} → {formatMonth(project.expected_end_date)}</dd></div><div><dt>Quartier</dt><dd>{project.district||"Nova Terra"}</dd></div>{project.supportEnabled?<div><dt>Soutiens</dt><dd>{project.supportCount}</dd></div>:null}</dl>
          <button className="secondary-action" type="button" onClick={()=>navigate(`/citizen/projects/${project.slug}`)}>Voir le projet →</button>
        </article>)}
      </section>
      {!loading&&visible.length?<PortalPagination page={page} totalPages={totalPages} totalItems={visible.length} perPage={perPage} onPageChange={setPage} itemLabel="projet" itemLabelPlural="projets"/>:null}

      {ideaOpen?<div className="project-modal-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)setIdeaOpen(false)}}><section className="project-modal" role="dialog" aria-modal="true" aria-labelledby="idea-title"><div className="project-modal__head"><div><h3 id="idea-title">Proposer une idée</h3><p>Une référence de suivi sera créée par Nova Terra.</p></div><button type="button" aria-label="Fermer" onClick={()=>setIdeaOpen(false)}>×</button></div><form onSubmit={submitIdea} className="project-form">
        <label><span>Titre</span><input value={idea.title} onChange={e=>setIdea(v=>({...v,title:e.target.value}))} placeholder="Ex. Installer des bancs au Jardin Lyra" required/></label>
        <div className="project-form__row"><label><span>Catégorie</span><select value={idea.category} onChange={e=>setIdea(v=>({...v,category:e.target.value}))}>{CATEGORIES.map(v=><option key={v}>{v}</option>)}</select></label><label><span>Quartier</span><select value={idea.district} onChange={e=>setIdea(v=>({...v,district:e.target.value}))}>{DISTRICTS.map(v=><option key={v}>{v}</option>)}</select></label></div>
        <label><span>Projet lié — facultatif</span><select value={idea.project_slug} onChange={e=>setIdea(v=>({...v,project_slug:e.target.value}))}><option value="">Idée générale pour la ville</option>{projects.map(project=><option key={project.slug} value={project.slug}>{project.title}</option>)}</select></label>
        <label><span>Votre proposition</span><textarea value={idea.description} onChange={e=>setIdea(v=>({...v,description:e.target.value}))} placeholder="Expliquez simplement le besoin et l’amélioration proposée…" required/></label>
        <div className="project-form__actions"><button type="button" className="secondary-action" onClick={()=>setIdeaOpen(false)}>Annuler</button><button type="submit" className="primary-action" disabled={saving}>{saving?"Envoi…":"Envoyer ma proposition"}</button></div>
      </form></section></div>:null}

      {ideasOpen?<div className="project-modal-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)setIdeasOpen(false)}}><section className="project-modal project-modal--ideas" role="dialog" aria-modal="true" aria-labelledby="ideas-title"><div className="project-modal__head"><div><h3 id="ideas-title">Mes idées proposées</h3><p>Retrouvez les références et l’état de vos propositions.</p></div><button type="button" aria-label="Fermer" onClick={()=>setIdeasOpen(false)}>×</button></div><div className="citizen-ideas-history__list citizen-ideas-history__list--modal">{ideas.length?ideas.map(item=><div key={item.reference||item.id}><div><strong>{item.title}</strong><span>{item.category}{item.district?` · ${item.district}`:""}{item.statusLabel?` · ${item.statusLabel}`:""}</span></div><b>{item.reference}</b></div>):<p className="detail-copy">Vous n’avez encore proposé aucune idée.</p>}</div></section></div>:null}
    </main>
  </div></div>;
}

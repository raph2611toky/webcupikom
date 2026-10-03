import { useEffect, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getMunicipalProject, getMyProjectContribution, submitProjectContribution } from "../../api/projects.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/projects.css";

const STATUS={planned:"Planifié",in_progress:"En cours",consultation:"Consultation",completed:"Terminé"};
const OPINIONS=[["very_favorable","Très favorable"],["favorable","Favorable"],["neutral","Neutre"],["unfavorable","Défavorable"]];
const DECISIONS=[["yes","Oui"],["no","Non"],["no_opinion","Sans avis"]];

function formatDate(value,{withTime=false}={}){
  if(!value)return "—";const d=new Date(value);if(Number.isNaN(d.getTime()))return value;
  return new Intl.DateTimeFormat("fr-FR",withTime?{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}:{day:"2-digit",month:"long",year:"numeric"}).format(d);
}

export default function CitizenProjectDetails({params}){
  const {user}=useAuth();
  const [project,setProject]=useState(null);
  const [contribution,setContribution]=useState(null);
  const [choice,setChoice]=useState("");
  const [comment,setComment]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  async function load(){
    const row=await getMunicipalProject(params.id);
    setProject(row);
    const existing=await getMyProjectContribution(row.id,user);
    setContribution(existing);setChoice(existing?.choice||"");setComment(existing?.comment||"");
  }
  useEffect(()=>{load().catch(()=>setError("Projet municipal introuvable."))},[params.id,user?.id,user?.email]);

  async function submit(event){
    event.preventDefault();if(!choice){setError("Choisissez une réponse avant de valider.");return}
    setSaving(true);setError("");
    try{const saved=await submitProjectContribution(project,user,{type:project.participation_type,choice,comment});setContribution(saved)}
    catch{setError("Impossible d’enregistrer votre participation.")}
    finally{setSaving(false)}
  }

  if(!project)return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow="Projets municipaux" title="Projet"/><main className="portal-content">{error?<div className="error-card">{error}</div>:<div className="loading-card">Chargement…</div>}</main></div></div>;
  const isDecision=project.participation_type==="decision";
  const decisionClosed=isDecision&&project.decision_closes_at&&new Date(project.decision_closes_at).getTime()<Date.now();
  const options=isDecision?DECISIONS:OPINIONS;

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Projets municipaux" title={project.title}/>
    <main className="portal-content project-detail-page">
      <button className="back-link" onClick={()=>navigate("/citizen/projects")}>← Projets municipaux</button>
      {error?<div className="error-card" role="alert">{error}</div>:null}
      {contribution?<div className="project-receipt" role="status"><strong>✓ Votre {isDecision?"participation":"avis"} a bien été enregistré{isDecision?"e":""}.</strong><span>Enregistré le {formatDate(contribution.updated_at||contribution.created_at,{withTime:true})}</span><b>Trace : {contribution.reference}</b></div>:null}

      <section className="project-detail-hero portal-card">
        <div><div className="project-detail-badges"><span className={`project-status status-${project.status}`}>● {STATUS[project.status]||project.status}</span>{project.participation_type!=="none"?<span className="project-participation-badge">{isDecision?"Décision citoyenne":"Consultation ouverte"}</span>:null}</div><h2>{project.title}</h2><p>{project.description}</p></div>
        <div className="project-progress project-progress--hero"><div><span>Progression</span><b>{project.progress}%</b></div><progress value={project.progress} max="100">{project.progress}%</progress></div>
        <div className="project-date-grid"><div><span>Début</span><strong>{formatDate(project.start_date)}</strong></div><div><span>Livraison estimée</span><strong>{formatDate(project.expected_end_date)}</strong></div><div><span>Quartier</span><strong>{project.district}</strong></div></div>
      </section>

      <section className="project-detail-grid">
        <article className="portal-card"><span className="section-label">Objectifs</span><h3>Ce que le projet doit améliorer</h3><ul className="project-objectives">{project.objectives.map(item=><li key={item}>{item}</li>)}</ul></article>
        <article className="portal-card"><span className="section-label">Dernières avancées</span><h3>Étapes du projet</h3><div className="project-milestones">{project.milestones.map((item,index)=><div key={`${item.title}-${index}`} className={`milestone-${item.status}`}><i>{item.status==="completed"?"✓":item.status==="current"?"●":"○"}</i><span>{item.title}</span></div>)}</div></article>
      </section>

      {project.participation_type!=="none"?<section className={`portal-card project-participation-card ${isDecision?"is-decision":""}`}>
        <div className="project-participation-copy"><span className="section-label">{isDecision?"F65 · Décision citoyenne":"F66 · Consultation"}</span><h3>{isDecision?"Consultation citoyenne":"Votre avis nous intéresse"}</h3><p>{project.participation_question}</p>{isDecision&&project.decision_closes_at?<small>Clôture : {formatDate(project.decision_closes_at,{withTime:true})}</small>:<small>Cette consultation n’est pas un vote officiel.</small>}</div>
        {decisionClosed?<div className="project-closed-note" role="status">Cette décision citoyenne est clôturée. Votre dernière contribution reste consultable ci-dessus.</div>:<form className="project-participation-form" onSubmit={submit}>
          <div className="project-choice-grid" role="radiogroup" aria-label={project.participation_question}>{options.map(([value,label])=><label key={value} className={choice===value?"is-selected":""}><input type="radio" name="project-choice" value={value} checked={choice===value} onChange={e=>setChoice(e.target.value)}/><span>{label}</span></label>)}</div>
          {!isDecision?<label className="project-comment"><span>Commentaire facultatif</span><textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Vous pouvez préciser votre avis…"/></label>:null}
          <button className="primary-action" type="submit" disabled={saving}>{saving?"Enregistrement…":contribution?"Mettre à jour ma contribution":isDecision?"Valider ma participation":"Envoyer mon avis"}</button>
        </form>}
      </section>:<section className="portal-card project-no-participation"><span className="section-label">Information</span><h3>Projet en information publique</h3><p>Aucune consultation n’est ouverte sur ce projet actuellement. Vous pouvez suivre son avancement ici.</p></section>}
    </main>
  </div></div>;
}

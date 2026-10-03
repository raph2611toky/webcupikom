import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getMunicipalProject, getMyProjectContribution, getProjectSupport, setProjectSupport, submitProjectContribution } from "../../api/projects.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/projects.css";

const STATUS={planned:"Planifié",in_progress:"En cours",paused:"En pause",completed:"Terminé",cancelled:"Annulé"};

function formatDate(value,{withTime=false}={}){
  if(!value)return "—";
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return value;
  return new Intl.DateTimeFormat("fr-FR",withTime?{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}:{day:"2-digit",month:"long",year:"numeric"}).format(d);
}

export default function CitizenProjectDetails({params}){
  const {user}=useAuth();
  const [project,setProject]=useState(null);
  const [contribution,setContribution]=useState(null);
  const [support,setSupport]=useState(null);
  const [choice,setChoice]=useState("");
  const [comment,setComment]=useState("");
  const [saving,setSaving]=useState(false);
  const [supportBusy,setSupportBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");

  async function load(){
    setError("");
    const row=await getMunicipalProject(params.id,{force:true});
    setProject(row);
    const [existing,supportState]=await Promise.all([
      row.participation_type!=="none"?getMyProjectContribution(row.slug).catch(()=>null):Promise.resolve(null),
      row.supportEnabled?getProjectSupport(row.slug).catch(()=>null):Promise.resolve(null),
    ]);
    setContribution(existing);
    setChoice(existing?.choice||"");
    setComment(existing?.comment||"");
    setSupport(supportState);
  }
  useEffect(()=>{load().catch(e=>setError(getApiErrorMessage(e,"Projet municipal introuvable.")))},[params.id,user?.id,user?.email]);

  const options=useMemo(()=>project?.participationOptions||[],[project]);
  const participationClosed=Boolean(project&&project.participation_type!=="none"&&!project.participationIsOpen);

  async function submit(event){
    event.preventDefault();
    if(!choice){setError("Choisissez une réponse avant de valider.");return}
    setSaving(true);setError("");setNotice("");
    try{
      const saved=await submitProjectContribution(project,user,{choice,comment});
      setContribution(saved);
      setNotice(saved.confirmation||"Votre participation a bien été enregistrée.");
      const refreshed=await getMunicipalProject(project.slug,{force:true}).catch(()=>null);
      if(refreshed)setProject(refreshed);
    }catch(e){setError(getApiErrorMessage(e,"Impossible d’enregistrer votre participation."))}
    finally{setSaving(false)}
  }

  async function toggleSupport(){
    if(!project||supportBusy)return;
    const next=!Boolean(support?.supported);
    setSupportBusy(true);setError("");setNotice("");
    try{
      const state=await setProjectSupport(project.slug,next);
      setSupport(state);
      setNotice(state.message|| (next?"Votre soutien a été enregistré.":"Votre soutien a été retiré."));
      const refreshed=await getMunicipalProject(project.slug,{force:true}).catch(()=>null);
      if(refreshed)setProject(refreshed);
    }catch(e){setError(getApiErrorMessage(e,"Impossible de mettre à jour votre soutien."))}
    finally{setSupportBusy(false)}
  }

  if(!project)return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow="Projets municipaux" title="Projet"/><main className="portal-content">{error?<div className="error-card">{error}</div>:<div className="loading-card">Chargement…</div>}</main></div></div>;
  const isDecision=project.participation_type==="decision";

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Projets municipaux" title={project.title}/>
    <main className="portal-content project-detail-page">
      <button className="back-link" onClick={()=>navigate("/citizen/projects")}>← Projets municipaux</button>
      {error?<div className="error-card" role="alert">{error}</div>:null}
      {notice?<div className="success-inline" role="status">✓ {notice}</div>:null}
      {contribution?<div className="project-receipt" role="status"><strong>✓ Votre {isDecision?"participation":"avis"} est enregistré.</strong><span>{contribution.createdAt?`Enregistré le ${formatDate(contribution.createdAt,{withTime:true})}`:"Trace conservée par Nova Terra"}</span><b>{contribution.reference?`Trace : ${contribution.reference}`:""}</b></div>:null}

      <section className="project-detail-hero portal-card">
        <div className="project-detail-hero__main">
          <div className="project-detail-badges"><span className={`project-status status-${project.status}`}>● {project.statusLabel||STATUS[project.status]||project.status}</span>{project.participation_type!=="none"?<span className="project-participation-badge">{project.participationTypeLabel|| (isDecision?"Décision citoyenne":"Consultation")}</span>:null}</div>
          <h2>{project.title}</h2><p>{project.description}</p>
        </div>
        <div className="project-detail-summary">
          <div className="project-progress project-progress--hero"><div><span>Progression</span><b>{project.progress}%</b></div><progress value={project.progress} max="100">{project.progress}%</progress></div>
          {project.supportEnabled?<button type="button" className={`project-support-button ${support?.supported?"is-supported":""}`} aria-pressed={Boolean(support?.supported)} disabled={supportBusy} onClick={toggleSupport}><span aria-hidden="true">♡</span><div><b>{support?.supported?"Projet soutenu":"Soutenir ce projet"}</b><small>{support?.supportCount??project.supportCount} soutien(s)</small></div></button>:null}
        </div>
        <div className="project-date-grid"><div><span>Début</span><strong>{formatDate(project.start_date)}</strong></div><div><span>Livraison estimée</span><strong>{formatDate(project.expected_end_date)}</strong></div><div><span>Quartier</span><strong>{project.district}</strong></div></div>
      </section>

      <section className="project-detail-grid">
        <article className="portal-card"><h3>Objectifs</h3>{project.objectives.length?<ul className="project-objectives">{project.objectives.map((item,index)=><li key={`${item}-${index}`}>{item}</li>)}</ul>:<p className="detail-copy">Les objectifs détaillés seront publiés par l’administration.</p>}</article>
        <article className="portal-card"><h3>Dernières avancées</h3>{project.milestones.length?<div className="project-milestones">{project.milestones.map((item,index)=><div key={`${item.title}-${index}`} className={`milestone-${item.status}`}><i>{item.status==="completed"?"✓":item.status==="current"?"●":"○"}</i><span>{item.title}</span></div>)}</div>:<p className="detail-copy">Aucune étape détaillée n’a encore été publiée.</p>}</article>
      </section>

      {project.participation_type!=="none"?<section className={`portal-card project-participation-card ${isDecision?"is-decision":""}`}>
        <div className="project-participation-copy"><span className="section-label">{isDecision?"Décision citoyenne":"Consultation"}</span><h3>{isDecision?"Participez à la décision":"Votre avis nous intéresse"}</h3><p>{project.participation_question||"Donnez votre avis sur ce projet municipal."}</p>{project.participation_closes_at?<small>Clôture : {formatDate(project.participation_closes_at,{withTime:true})}</small>:<small>{isDecision?"Votre participation laisse une trace claire.":"Cette consultation n’est pas un vote officiel."}</small>}</div>
        {participationClosed?<div className="project-closed-note" role="status">Cette participation est actuellement fermée. Votre dernière contribution reste consultable ci-dessus.</div>:<form className="project-participation-form" onSubmit={submit}>
          <div className="project-choice-grid" role="radiogroup" aria-label={project.participation_question||"Choix de participation"}>{options.map(({value,label})=><label key={value} className={choice===value?"is-selected":""}><input type="radio" name="project-choice" value={value} checked={choice===value} onChange={e=>setChoice(e.target.value)}/><span>{label}</span></label>)}</div>
          {!isDecision?<label className="project-comment"><span>Commentaire facultatif</span><textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Vous pouvez préciser votre avis…"/></label>:null}
          <button className="primary-action" type="submit" disabled={saving}>{saving?"Enregistrement…":contribution?"Mettre à jour ma contribution":isDecision?"Valider ma participation":"Envoyer mon avis"}</button>
        </form>}
      </section>:<section className="portal-card project-no-participation"><h3>Suivre ce projet</h3><p>Aucune consultation n’est ouverte actuellement. Les informations d’avancement restent disponibles sur cette fiche.</p></section>}
    </main>
  </div></div>;
}

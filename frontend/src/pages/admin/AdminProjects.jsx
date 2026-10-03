import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import {
  createAdminMunicipalProject,
  deleteAdminMunicipalProject,
  getAdminMunicipalProjects,
  getAllCitizenIdeas,
  getAllProjectContributions,
  updateAdminCitizenIdea,
  updateAdminMunicipalProject,
} from "../../api/projects.js";
import { getApiErrorMessage } from "../../api/auth.js";
import "../../styles/app-shell.css";
import "../../styles/pages/projects.css";

const STATUS={planned:"Planifié",in_progress:"En cours",paused:"En pause",completed:"Terminé",cancelled:"Annulé"};
const IDEA_STATUS={submitted:"Reçue",under_review:"À l’étude",accepted:"Acceptée",rejected:"Refusée",implemented:"Mise en œuvre"};
const EMPTY={
  slug:"",title:"",summary:"",description:"",district:"Nova Centre",status:"planned",progress:0,
  start_date:"",expected_end_date:"",actual_end_date:"",participation_type:"none",participation_question:"",
  participation_opens_at:"",participation_closes_at:"",support_enabled:false,is_published:true,
  objectivesText:"",milestonesText:"",
};

function toLocalDateTime(value){return value?String(value).slice(0,16):""}
function editorFromProject(project){
  return {
    ...EMPTY,
    ...project,
    summary:project.summary||project.shortDescription||"",
    objectivesText:(project.objectives||[]).join("\n"),
    milestonesText:(project.milestones||[]).map(item=>`${item.status||"upcoming"}|${item.title}`).join("\n"),
    participation_opens_at:toLocalDateTime(project.participation_opens_at),
    participation_closes_at:toLocalDateTime(project.participation_closes_at),
    support_enabled:Boolean(project.supportEnabled),
    is_published:project.isPublished!==false,
  };
}
function parseMilestones(text=""){
  return String(text).split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map((line,index)=>{
    const [maybeStatus,...rest]=line.split("|");
    const allowed=["completed","current","upcoming"];
    return allowed.includes(maybeStatus.trim())
      ? {status:maybeStatus.trim(),title:rest.join("|").trim()||`Étape ${index+1}`}
      : {status:index===0?"current":"upcoming",title:line};
  });
}
function formatDate(value){if(!value)return"—";const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)}

export default function AdminProjects(){
  const [tab,setTab]=useState("projects");
  const [projects,setProjects]=useState([]);
  const [contributions,setContributions]=useState([]);
  const [ideas,setIdeas]=useState([]);
  const [editor,setEditor]=useState(null);
  const [ideaEditor,setIdeaEditor]=useState(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  async function load(){
    setLoading(true);setError("");
    try{
      const [p,c,i]=await Promise.all([getAdminMunicipalProjects(),getAllProjectContributions(),getAllCitizenIdeas()]);
      setProjects(p);setContributions(c);setIdeas(i);
    }catch(e){setError(getApiErrorMessage(e,"Impossible de charger la gestion des projets."))}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);
  useEffect(()=>{
    const query=new URLSearchParams(window.location.search);
    if(query.get("new")==="1")setEditor({...EMPTY});
  },[]);

  const stats=useMemo(()=>({
    published:projects.filter(p=>p.isPublished!==false).length,
    participation:projects.filter(p=>p.participation_type!=="none"&&p.participationIsOpen).length,
    contributions:contributions.length,
    ideas:ideas.filter(i=>["submitted","under_review"].includes(i.status)).length,
  }),[projects,contributions,ideas]);

  async function saveProject(event){
    event.preventDefault();
    if(!editor?.title?.trim()||!editor?.description?.trim()){setError("Le titre et la description sont obligatoires.");return}
    setSaving(true);setError("");setNotice("");
    const payload={
      ...editor,
      short_description:editor.summary,
      objectives:String(editor.objectivesText||"").split(/\r?\n/).map(v=>v.trim()).filter(Boolean),
      milestones:parseMilestones(editor.milestonesText),
      support_enabled:Boolean(editor.support_enabled),
      is_published:Boolean(editor.is_published),
    };
    try{
      if(editor.slug)await updateAdminMunicipalProject(editor.slug,payload);
      else await createAdminMunicipalProject(payload);
      setEditor(null);setNotice("Projet enregistré sur le backend Nova Terra.");await load();
    }catch(e){setError(getApiErrorMessage(e,"Impossible d’enregistrer le projet."))}
    finally{setSaving(false)}
  }

  async function removeProject(project){
    if(!window.confirm(`Supprimer définitivement « ${project.title} » ?`))return;
    setSaving(true);setError("");
    try{await deleteAdminMunicipalProject(project.slug);setNotice("Projet supprimé.");await load()}
    catch(e){setError(getApiErrorMessage(e,"Impossible de supprimer le projet."))}
    finally{setSaving(false)}
  }

  async function saveIdea(event){
    event.preventDefault();if(!ideaEditor)return;
    setSaving(true);setError("");setNotice("");
    try{
      await updateAdminCitizenIdea(ideaEditor.reference,{status:ideaEditor.status,staff_note:ideaEditor.staffNote});
      setIdeaEditor(null);setNotice("Traitement de l’idée enregistré.");await load();
    }catch(e){setError(getApiErrorMessage(e,"Impossible de mettre à jour cette idée."))}
    finally{setSaving(false)}
  }

  return <div className="portal-layout"><AdminSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Participation citoyenne" title="Projets municipaux" actions={<button className="primary-action" onClick={()=>setEditor({...EMPTY})}>+ Nouveau projet</button>}/>
    <main className="portal-content admin-projects-page">
      {error?<div className="error-card" role="alert">{error}</div>:null}
      {notice?<div className="success-inline" role="status">✓ {notice}</div>:null}

      <section className="project-admin-summary">
        <article><span>Publiés</span><strong>{stats.published}</strong><small>projets visibles</small></article>
        <article><span>Participations</span><strong>{stats.participation}</strong><small>ouvertes</small></article>
        <article><span>Contributions</span><strong>{stats.contributions}</strong><small>traces enregistrées</small></article>
        <article><span>Idées à traiter</span><strong>{stats.ideas}</strong><small>citoyens</small></article>
      </section>

      <div className="project-admin-tabs" role="tablist" aria-label="Gestion des projets">
        <button type="button" className={tab==="projects"?"is-active":""} onClick={()=>setTab("projects")}>Projets <span>{projects.length}</span></button>
        <button type="button" className={tab==="contributions"?"is-active":""} onClick={()=>setTab("contributions")}>Contributions <span>{contributions.length}</span></button>
        <button type="button" className={tab==="ideas"?"is-active":""} onClick={()=>setTab("ideas")}>Idées <span>{ideas.length}</span></button>
      </div>

      {loading?<div className="loading-card">Chargement…</div>:null}

      {!loading&&tab==="projects"?<section className="project-admin-list">
        {projects.map(project=><article className="project-admin-row" key={project.id||project.slug}>
          <div className="project-admin-row__progress"><strong>{project.progress}%</strong><progress value={project.progress} max="100">{project.progress}%</progress></div>
          <div className="project-admin-row__body"><div className="project-admin-row__badges"><span className={`project-status status-${project.status}`}>{project.statusLabel||STATUS[project.status]||project.status}</span><span className={`project-publish-state ${project.isPublished!==false?"is-published":""}`}>{project.isPublished!==false?"Publié":"Brouillon"}</span></div><h3>{project.title}</h3><p>{project.district||"Nova Terra"} · {project.participation_type==="none"?"Information":project.participation_type==="decision"?"Décision citoyenne":"Consultation"}</p></div>
          <div className="project-admin-row__counts"><span><b>{project.participationCount||0}</b> participations</span><span><b>{project.supportCount||0}</b> soutiens</span><span><b>{project.ideaCount||0}</b> idées</span></div>
          <div className="project-admin-row__actions"><button className="secondary-action" type="button" onClick={()=>setEditor(editorFromProject(project))}>Modifier</button><button className="danger-action" type="button" disabled={saving} onClick={()=>removeProject(project)}>Supprimer</button></div>
        </article>)}
        {!projects.length?<div className="portal-card project-empty-state"><strong>Aucun projet municipal</strong><span>Créez le premier projet pour le rendre visible aux citoyens.</span></div>:null}
      </section>:null}

      {!loading&&tab==="contributions"?<section className="portal-card project-admin-table-card"><div className="portal-card__head"><div><h3>Contributions citoyennes</h3><p>Consultations et décisions avec leur référence de traçabilité.</p></div></div><div className="project-admin-contributions">{contributions.map(item=><article key={item.reference||item.id}><div><strong>{item.projectTitle}</strong><span>{item.citizenName} · {item.citizenEmail}</span></div><div><b>{item.choiceLabel||item.choice}</b><span>{item.typeLabel||item.type}</span></div><div><code>{item.reference}</code><span>{formatDate(item.createdAt)}</span></div></article>)}{!contributions.length?<p className="detail-copy">Aucune contribution enregistrée.</p>:null}</div></section>:null}

      {!loading&&tab==="ideas"?<section className="project-admin-ideas">{ideas.map(item=><article className="portal-card" key={item.reference||item.id}><div className="project-admin-idea__head"><div><span className={`idea-status status-${item.status}`}>{item.statusLabel||IDEA_STATUS[item.status]||item.status}</span><h3>{item.title}</h3></div><code>{item.reference}</code></div><p>{item.description}</p><div className="project-admin-idea__meta"><span>{item.category}{item.district?` · ${item.district}`:""}</span><span>{item.citizenName} · {formatDate(item.createdAt)}</span></div><button type="button" className="secondary-action" onClick={()=>setIdeaEditor({...item})}>Traiter l’idée</button></article>)}{!ideas.length?<div className="portal-card project-empty-state"><strong>Aucune idée citoyenne</strong><span>Les propositions envoyées depuis l’espace citoyen apparaîtront ici.</span></div>:null}</section>:null}

      {editor?<div className="project-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setEditor(null)}}><section className="project-modal project-modal--wide project-admin-editor" role="dialog" aria-modal="true" aria-labelledby="project-editor-title"><div className="project-modal__head"><div><h3 id="project-editor-title">{editor.slug?"Modifier le projet":"Nouveau projet"}</h3><p>Les informations publiées seront visibles dans l’espace citoyen.</p></div><button type="button" aria-label="Fermer" onClick={()=>setEditor(null)}>×</button></div><form className="project-form" onSubmit={saveProject}>
        <div className="project-form__row"><label><span>Titre</span><input value={editor.title} onChange={e=>setEditor(v=>({...v,title:e.target.value}))} required/></label><label><span>Quartier</span><input value={editor.district} onChange={e=>setEditor(v=>({...v,district:e.target.value}))}/></label></div>
        <label><span>Résumé court</span><input maxLength="320" value={editor.summary} onChange={e=>setEditor(v=>({...v,summary:e.target.value}))}/></label>
        <label><span>Description complète</span><textarea value={editor.description} onChange={e=>setEditor(v=>({...v,description:e.target.value}))} required/></label>
        <div className="project-form__row"><label><span>Statut</span><select value={editor.status} onChange={e=>setEditor(v=>({...v,status:e.target.value}))}>{Object.entries(STATUS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label><span>Progression %</span><input type="number" min="0" max="100" value={editor.progress} onChange={e=>setEditor(v=>({...v,progress:Number(e.target.value)}))}/></label></div>
        <div className="project-form__row"><label><span>Date de début</span><input type="date" value={editor.start_date||""} onChange={e=>setEditor(v=>({...v,start_date:e.target.value}))}/></label><label><span>Fin estimée</span><input type="date" value={editor.expected_end_date||""} onChange={e=>setEditor(v=>({...v,expected_end_date:e.target.value}))}/></label></div>
        <div className="project-form__row"><label><span>Objectifs — un par ligne</span><textarea value={editor.objectivesText} onChange={e=>setEditor(v=>({...v,objectivesText:e.target.value}))} placeholder={'Créer un espace vert\nAméliorer les déplacements'}/></label><label><span>Étapes — statut|titre</span><textarea value={editor.milestonesText} onChange={e=>setEditor(v=>({...v,milestonesText:e.target.value}))} placeholder={'completed|Étude terminée\ncurrent|Travaux en cours\nupcoming|Livraison'}/></label></div>
        <div className="project-form__row"><label><span>Participation</span><select value={editor.participation_type} onChange={e=>setEditor(v=>({...v,participation_type:e.target.value}))}><option value="none">Aucune</option><option value="consultation">Consultation</option><option value="decision">Décision citoyenne</option></select></label><label><span>Publication</span><select value={editor.is_published?"published":"draft"} onChange={e=>setEditor(v=>({...v,is_published:e.target.value==="published"}))}><option value="published">Publié</option><option value="draft">Brouillon</option></select></label></div>
        {editor.participation_type!=="none"?<><label><span>Question de participation</span><textarea value={editor.participation_question||""} onChange={e=>setEditor(v=>({...v,participation_question:e.target.value}))}/></label><div className="project-form__row"><label><span>Ouverture</span><input type="datetime-local" value={editor.participation_opens_at||""} onChange={e=>setEditor(v=>({...v,participation_opens_at:e.target.value}))}/></label><label><span>Clôture</span><input type="datetime-local" value={editor.participation_closes_at||""} onChange={e=>setEditor(v=>({...v,participation_closes_at:e.target.value}))}/></label></div></>:null}
        <label className="project-admin-check"><input type="checkbox" checked={Boolean(editor.support_enabled)} onChange={e=>setEditor(v=>({...v,support_enabled:e.target.checked}))}/><span>Autoriser le soutien léger au projet</span></label>
        <div className="project-form__actions"><button type="button" className="secondary-action" onClick={()=>setEditor(null)}>Annuler</button><button type="submit" className="primary-action" disabled={saving}>{saving?"Enregistrement…":"Enregistrer le projet"}</button></div>
      </form></section></div>:null}

      {ideaEditor?<div className="project-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setIdeaEditor(null)}}><section className="project-modal" role="dialog" aria-modal="true" aria-labelledby="idea-editor-title"><div className="project-modal__head"><div><h3 id="idea-editor-title">Traiter l’idée {ideaEditor.reference}</h3><p>{ideaEditor.title}</p></div><button type="button" aria-label="Fermer" onClick={()=>setIdeaEditor(null)}>×</button></div><form className="project-form" onSubmit={saveIdea}><label><span>Statut</span><select value={ideaEditor.status} onChange={e=>setIdeaEditor(v=>({...v,status:e.target.value}))}>{Object.entries(IDEA_STATUS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label><span>Note interne</span><textarea value={ideaEditor.staffNote||""} onChange={e=>setIdeaEditor(v=>({...v,staffNote:e.target.value}))} placeholder="Décision ou commentaire de traitement…"/></label><div className="project-form__actions"><button type="button" className="secondary-action" onClick={()=>setIdeaEditor(null)}>Annuler</button><button type="submit" className="primary-action" disabled={saving}>{saving?"Enregistrement…":"Enregistrer"}</button></div></form></section></div>:null}
    </main>
  </div></div>;
}

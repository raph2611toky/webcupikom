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

const STATUS={planned:"Planifié",in_progress:"En cours",paused:"En pause",completed:"Terminé",cancelled:"Annulé"};
const IDEA_STATUS={submitted:"Envoyée",under_review:"À l’étude",accepted:"Retenue",rejected:"Non retenue",implemented:"Mise en œuvre"};
const DEFAULT_OPTIONS={
  consultation:[
    {value:"very_favorable",label:"Très favorable"},
    {value:"favorable",label:"Favorable"},
    {value:"neutral",label:"Neutre"},
    {value:"unfavorable",label:"Défavorable"},
  ],
  decision:[
    {value:"yes",label:"Oui"},
    {value:"no",label:"Non"},
    {value:"no_opinion",label:"Sans avis"},
  ],
};
const EMPTY={
  slug:"",title:"",summary:"",description:"",district:"Nova Centre",status:"planned",progress:0,
  start_date:"",expected_end_date:"",actual_end_date:"",participation_type:"none",participation_question:"",
  participation_opens_at:"",participation_closes_at:"",support_enabled:false,is_published:false,
  objectivesText:"",milestonesText:"",optionsText:"",
};

function toLocalDateTime(value){return value?String(value).slice(0,16):""}
function formatDate(value){if(!value)return"—";const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)}
function optionLines(type){return (DEFAULT_OPTIONS[type]||[]).map(item=>`${item.value}|${item.label}`).join("\n")}
function editorFromProject(project){
  return {
    ...EMPTY,...project,
    summary:project.summary||project.shortDescription||"",
    objectivesText:(project.objectives||[]).join("\n"),
    milestonesText:(project.milestones||[]).map(item=>`${item.status||"pending"}|${item.title}`).join("\n"),
    optionsText:(project.participationOptions||[]).map(item=>`${item.value}|${item.label}`).join("\n"),
    participation_opens_at:toLocalDateTime(project.participation_opens_at),
    participation_closes_at:toLocalDateTime(project.participation_closes_at),
    support_enabled:Boolean(project.supportEnabled),
    is_published:project.isPublished!==false,
  };
}
function parseMilestones(text=""){
  return String(text).split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map((line,index)=>{
    const [maybeStatus,...rest]=line.split("|");
    const status=maybeStatus.trim()==="upcoming"?"pending":maybeStatus.trim();
    const allowed=["completed","current","pending"];
    return allowed.includes(status)
      ? {status,title:rest.join("|").trim()||`Étape ${index+1}`}
      : {status:index===0?"current":"pending",title:line};
  });
}
function parseOptions(text=""){
  const seen=new Set();
  return String(text).split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map((line,index)=>{
    const [rawValue,...rest]=line.split("|");
    const value=rawValue.trim();
    const label=rest.join("|").trim();
    if(!value||!label)throw new Error(`Choix ${index+1} : utilisez le format valeur|Libellé.`);
    if(seen.has(value))throw new Error(`La valeur « ${value} » est utilisée plusieurs fois.`);
    seen.add(value);
    return {value,label};
  });
}

export default function AdminProjects(){
  const [tab,setTab]=useState("projects");
  const [projects,setProjects]=useState([]);
  const [contributions,setContributions]=useState([]);
  const [ideas,setIdeas]=useState([]);
  const [editor,setEditor]=useState(null);
  const [ideaEditor,setIdeaEditor]=useState(null);
  const [query,setQuery]=useState("");
  const [projectFilter,setProjectFilter]=useState("all");
  const [contributionFilter,setContributionFilter]=useState("all");
  const [ideaFilter,setIdeaFilter]=useState("all");
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
  useEffect(()=>{const q=new URLSearchParams(window.location.search);if(q.get("new")==="1")setEditor({...EMPTY})},[]);

  const stats=useMemo(()=>({
    published:projects.filter(p=>p.isPublished!==false).length,
    participation:projects.filter(p=>p.participation_type!=="none"&&p.participationIsOpen).length,
    contributions:contributions.length,
    ideas:ideas.filter(i=>["submitted","under_review"].includes(i.status)).length,
  }),[projects,contributions,ideas]);

  const visibleProjects=useMemo(()=>projects.filter(project=>{
    const needle=query.trim().toLowerCase();
    const matchesText=!needle||`${project.title} ${project.district} ${project.summary}`.toLowerCase().includes(needle);
    const matchesState=projectFilter==="all"||(projectFilter==="published"?project.isPublished!==false:projectFilter==="draft"?project.isPublished===false:project.participation_type===projectFilter);
    return matchesText&&matchesState;
  }),[projects,query,projectFilter]);

  const visibleContributions=useMemo(()=>{
    const needle=query.trim().toLowerCase();
    return contributions.filter(item=>{
      const matchesText=!needle||`${item.projectTitle} ${item.citizenName} ${item.citizenEmail} ${item.choiceLabel} ${item.reference}`.toLowerCase().includes(needle);
      const matchesType=contributionFilter==="all"||item.type===contributionFilter;
      return matchesText&&matchesType;
    });
  },[contributions,query,contributionFilter]);

  const visibleIdeas=useMemo(()=>{
    const needle=query.trim().toLowerCase();
    return ideas.filter(item=>{
      const matchesText=!needle||`${item.title} ${item.category} ${item.district} ${item.citizenName} ${item.reference} ${item.projectTitle}`.toLowerCase().includes(needle);
      const matchesStatus=ideaFilter==="all"||item.status===ideaFilter;
      return matchesText&&matchesStatus;
    });
  },[ideas,query,ideaFilter]);

  function changeParticipationType(type){
    setEditor(current=>{
      const existing=String(current?.optionsText||"").trim();
      const changed=current?.participation_type!==type;
      return {...current,participation_type:type,optionsText:type==="none"?"":(changed?optionLines(type):(existing||optionLines(type)))};
    });
  }

  async function saveProject(event){
    event.preventDefault();
    if(!editor?.title?.trim()||!editor?.description?.trim()){setError("Le titre et la description sont obligatoires.");return}
    let participationOptions=[];
    try{
      if(editor.participation_type!=="none"){
        participationOptions=parseOptions(editor.optionsText||optionLines(editor.participation_type));
        if(participationOptions.length<2)throw new Error("Ajoutez au moins deux choix pour la participation citoyenne.");
        if(!editor.participation_question?.trim())throw new Error("Ajoutez une question claire pour la participation citoyenne.");
      }
    }catch(e){setError(e.message);return}
    setSaving(true);setError("");setNotice("");
    const payload={
      ...editor,
      short_description:editor.summary,
      objectives:String(editor.objectivesText||"").split(/\r?\n/).map(v=>v.trim()).filter(Boolean),
      milestones:parseMilestones(editor.milestonesText),
      participation_options:participationOptions,
      support_enabled:Boolean(editor.support_enabled),
      is_published:Boolean(editor.is_published),
    };
    try{
      if(editor.slug)await updateAdminMunicipalProject(editor.slug,payload);
      else await createAdminMunicipalProject(payload);
      setEditor(null);setNotice(editor.is_published?"Projet enregistré et publication synchronisée.":"Projet enregistré en brouillon.");await load();
    }catch(e){setError(getApiErrorMessage(e,"Impossible d’enregistrer le projet."))}
    finally{setSaving(false)}
  }

  async function unpublishProject(project){
    if(!window.confirm(`Retirer « ${project.title} » de la publication citoyenne ?`))return;
    setSaving(true);setError("");setNotice("");
    try{await deleteAdminMunicipalProject(project.slug);setNotice("Le projet a été retiré de la publication. Il reste conservé côté administration.");await load()}
    catch(e){setError(getApiErrorMessage(e,"Impossible de retirer le projet de la publication."))}
    finally{setSaving(false)}
  }

  async function saveIdea(event){
    event.preventDefault();if(!ideaEditor)return;
    setSaving(true);setError("");setNotice("");
    try{
      await updateAdminCitizenIdea(ideaEditor.reference,{status:ideaEditor.status,staff_note:ideaEditor.staffNote});
      setIdeaEditor(null);setNotice("Traitement de la proposition citoyenne enregistré.");await load();
    }catch(e){setError(getApiErrorMessage(e,"Impossible de mettre à jour cette idée."))}
    finally{setSaving(false)}
  }

  return <div className="portal-layout"><AdminSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Participation citoyenne" title="Projets municipaux" actions={<button type="button" className="primary-action" onClick={()=>setEditor({...EMPTY})}>+ Nouveau projet</button>}/>
    <main className="portal-content admin-projects-page">
      {error?<div className="error-card" role="alert">{error}</div>:null}
      {notice?<div className="success-inline" role="status">✓ {notice}</div>:null}

      <section className="project-admin-summary" aria-label="Résumé des projets municipaux">
        <article><span>Publiés</span><strong>{stats.published}</strong><small>visibles des citoyens</small></article>
        <article><span>Participation</span><strong>{stats.participation}</strong><small>consultations/décisions ouvertes</small></article>
        <article><span>Contributions</span><strong>{stats.contributions}</strong><small>reçus citoyens tracés</small></article>
        <article><span>Idées à traiter</span><strong>{stats.ideas}</strong><small>propositions en attente</small></article>
      </section>

      <section className="project-admin-controlbar" aria-label="Navigation et recherche">
        <div className="project-admin-tabs" role="tablist" aria-label="Gestion des projets">
          <button type="button" role="tab" aria-selected={tab==="projects"} className={tab==="projects"?"is-active":""} onClick={()=>setTab("projects")}>Projets <span>{projects.length}</span></button>
          <button type="button" role="tab" aria-selected={tab==="contributions"} className={tab==="contributions"?"is-active":""} onClick={()=>setTab("contributions")}>Avis & décisions <span>{contributions.length}</span></button>
          <button type="button" role="tab" aria-selected={tab==="ideas"} className={tab==="ideas"?"is-active":""} onClick={()=>setTab("ideas")}>Idées <span>{ideas.length}</span></button>
        </div>
        <label className="project-admin-search"><span className="sr-only">Rechercher</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={tab==="projects"?"Rechercher un projet…":tab==="contributions"?"Rechercher un avis ou citoyen…":"Rechercher une idée…"}/></label>
      </section>

      {tab==="projects"?<div className="project-admin-filterchips" role="toolbar" aria-label="Filtrer les projets">{[["all","Tous"],["published","Publiés"],["draft","Brouillons"],["consultation","Consultations"],["decision","Décisions"]].map(([value,label])=><button type="button" key={value} className={projectFilter===value?"is-active":""} aria-pressed={projectFilter===value} onClick={()=>setProjectFilter(value)}>{label}</button>)}</div>:null}
      {tab==="contributions"?<div className="project-admin-filterchips" role="toolbar" aria-label="Filtrer les participations">{[["all","Toutes"],["consultation","Avis / consultations"],["decision","Décisions"]].map(([value,label])=><button type="button" key={value} className={contributionFilter===value?"is-active":""} aria-pressed={contributionFilter===value} onClick={()=>setContributionFilter(value)}>{label}</button>)}</div>:null}
      {tab==="ideas"?<div className="project-admin-filterchips" role="toolbar" aria-label="Filtrer les idées">{[["all","Toutes"],["submitted","Envoyées"],["under_review","À l’étude"],["accepted","Retenues"],["rejected","Non retenues"],["implemented","Mises en œuvre"]].map(([value,label])=><button type="button" key={value} className={ideaFilter===value?"is-active":""} aria-pressed={ideaFilter===value} onClick={()=>setIdeaFilter(value)}>{label}</button>)}</div>:null}

      {loading?<div className="loading-card">Chargement…</div>:null}

      {!loading&&tab==="projects"?<section className="project-admin-list" aria-label="Liste des projets administrés">
        {visibleProjects.map(project=><article className="project-admin-row" key={project.id||project.slug}>
          <div className="project-admin-row__progress"><strong>{project.progress}%</strong><progress value={project.progress} max="100">{project.progress}%</progress></div>
          <div className="project-admin-row__body"><div className="project-admin-row__badges"><span className={`project-status status-${project.status}`}>{project.statusLabel||STATUS[project.status]||project.status}</span><span className={`project-publish-state ${project.isPublished!==false?"is-published":""}`}>{project.isPublished!==false?"Publié":"Brouillon"}</span>{project.participation_type!=="none"?<span className="project-participation-badge">{project.participation_type==="decision"?"Décision":"Consultation"}</span>:null}</div><h3>{project.title}</h3><p>{project.district||"Nova Terra"}{project.participationIsOpen?" · Participation ouverte":""}</p></div>
          <div className="project-admin-row__counts"><span><b>{project.participationCount||0}</b> participations</span><span><b>{project.supportCount||0}</b> soutiens</span><span><b>{project.ideaCount||0}</b> idées</span></div>
          <div className="project-admin-row__actions"><button className="secondary-action" type="button" onClick={()=>setEditor(editorFromProject(project))}>Modifier</button>{project.isPublished!==false?<button className="danger-action" type="button" disabled={saving} onClick={()=>unpublishProject(project)}>Dépublier</button>:null}</div>
        </article>)}
        {!visibleProjects.length?<div className="portal-card project-empty-state"><strong>Aucun projet correspondant</strong><span>Créez un projet ou modifiez vos filtres.</span></div>:null}
      </section>:null}

      {!loading&&tab==="contributions"?<section className="portal-card project-admin-table-card"><div className="portal-card__head"><div><h3>Avis et décisions citoyennes</h3><p>Chaque contribution est unique, datée et conserve la question ainsi que le choix présenté au citoyen.</p></div></div><div className="project-admin-contributions">{visibleContributions.map(item=><article key={item.reference||item.id}><div><strong>{item.projectTitle}</strong><span>{item.citizenName||item.citizenEmail} · {item.citizenEmail}</span>{item.question?<small>{item.question}</small>:null}</div><div><b>{item.choiceLabel||item.choice}</b><span>{item.typeLabel||item.type}</span>{item.comment?<small>« {item.comment} »</small>:null}</div><div><code>{item.reference}</code><span>{formatDate(item.createdAt)}</span></div></article>)}{!visibleContributions.length?<p className="detail-copy">Aucune contribution correspondante.</p>:null}</div></section>:null}

      {!loading&&tab==="ideas"?<section className="project-admin-ideas">{visibleIdeas.map(item=><article className="portal-card" key={item.reference||item.id}><div className="project-admin-idea__head"><div><span className={`idea-status status-${item.status}`}>{item.statusLabel||IDEA_STATUS[item.status]||item.status}</span><h3>{item.title}</h3></div><code>{item.reference}</code></div><p>{item.description}</p><div className="project-admin-idea__meta"><span>{item.projectTitle?`Projet : ${item.projectTitle}`:"Idée générale pour la ville"}</span><span>{item.category}{item.district?` · ${item.district}`:""}</span><span>{item.citizenName||item.citizenEmail} · {formatDate(item.createdAt)}</span>{item.staffNote?<span>Note : {item.staffNote}</span>:null}</div><button type="button" className="secondary-action" onClick={()=>setIdeaEditor({...item})}>Traiter la proposition</button></article>)}{!visibleIdeas.length?<div className="portal-card project-empty-state"><strong>Aucune idée correspondante</strong><span>Les propositions envoyées depuis l’espace citoyen apparaîtront ici.</span></div>:null}</section>:null}

      {editor?<div className="project-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setEditor(null)}}><section className="project-modal project-modal--wide project-admin-editor" role="dialog" aria-modal="true" aria-labelledby="project-editor-title"><div className="project-modal__head"><div><h3 id="project-editor-title">{editor.slug?"Modifier le projet":"Nouveau projet"}</h3><p>Le brouillon reste interne. En mode publié, la fiche devient visible des citoyens.</p></div><button type="button" aria-label="Fermer" onClick={()=>setEditor(null)}>×</button></div><form className="project-form" onSubmit={saveProject}>
        <div className="project-form__row"><label><span>Titre</span><input value={editor.title} onChange={e=>setEditor(v=>({...v,title:e.target.value}))} required/></label><label><span>Quartier</span><input value={editor.district} onChange={e=>setEditor(v=>({...v,district:e.target.value}))}/></label></div>
        <label><span>Résumé court</span><input maxLength="320" value={editor.summary} onChange={e=>setEditor(v=>({...v,summary:e.target.value}))} placeholder="Une phrase claire visible dans la liste des projets"/></label>
        <label><span>Description complète</span><textarea value={editor.description} onChange={e=>setEditor(v=>({...v,description:e.target.value}))} required/></label>
        <div className="project-form__row"><label><span>Statut du projet</span><select value={editor.status} onChange={e=>setEditor(v=>({...v,status:e.target.value}))}>{Object.entries(STATUS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label><span>Progression %</span><input type="number" min="0" max="100" value={editor.progress} onChange={e=>setEditor(v=>({...v,progress:Number(e.target.value)}))}/></label></div>
        <div className="project-form__row"><label><span>Date de début</span><input type="date" value={editor.start_date||""} onChange={e=>setEditor(v=>({...v,start_date:e.target.value}))}/></label><label><span>Fin estimée</span><input type="date" value={editor.expected_end_date||""} onChange={e=>setEditor(v=>({...v,expected_end_date:e.target.value}))}/></label></div>
        {editor.status==="completed"?<label><span>Date de fin réelle</span><input type="date" value={editor.actual_end_date||""} onChange={e=>setEditor(v=>({...v,actual_end_date:e.target.value}))}/></label>:null}
        <div className="project-form__row"><label><span>Objectifs — un par ligne</span><textarea value={editor.objectivesText} onChange={e=>setEditor(v=>({...v,objectivesText:e.target.value}))} placeholder={'Créer un espace vert\nAméliorer les déplacements'}/></label><label><span>Étapes — statut|titre</span><textarea value={editor.milestonesText} onChange={e=>setEditor(v=>({...v,milestonesText:e.target.value}))} placeholder={'completed|Étude terminée\ncurrent|Travaux en cours\npending|Livraison'}/><small>Statuts acceptés : completed, current, pending.</small></label></div>
        <div className="project-form__row"><label><span>Participation citoyenne</span><select value={editor.participation_type} onChange={e=>changeParticipationType(e.target.value)}><option value="none">Information uniquement</option><option value="consultation">Consultation / avis</option><option value="decision">Décision citoyenne</option></select></label><label><span>Publication</span><select value={editor.is_published?"published":"draft"} onChange={e=>setEditor(v=>({...v,is_published:e.target.value==="published"}))}><option value="draft">Brouillon interne</option><option value="published">Publié aux citoyens</option></select></label></div>
        {editor.participation_type!=="none"?<section className="project-form-participation"><label><span>Question présentée au citoyen</span><textarea value={editor.participation_question||""} onChange={e=>setEditor(v=>({...v,participation_question:e.target.value}))} placeholder={editor.participation_type==="decision"?"Faut-il retenir cette proposition ?":"Que pensez-vous de ce projet ?"} required/></label><label><span>Choix — valeur|libellé, un par ligne</span><textarea value={editor.optionsText||""} onChange={e=>setEditor(v=>({...v,optionsText:e.target.value}))} placeholder={optionLines(editor.participation_type)} required/><small>Ex. favorable|Favorable. Ces libellés sont ceux affichés aux citoyens.</small></label><div className="project-form__row"><label><span>Ouverture</span><input type="datetime-local" value={editor.participation_opens_at||""} onChange={e=>setEditor(v=>({...v,participation_opens_at:e.target.value}))}/></label><label><span>Clôture</span><input type="datetime-local" value={editor.participation_closes_at||""} onChange={e=>setEditor(v=>({...v,participation_closes_at:e.target.value}))}/></label></div></section>:null}
        <label className="project-admin-check"><input type="checkbox" checked={Boolean(editor.support_enabled)} onChange={e=>setEditor(v=>({...v,support_enabled:e.target.checked}))}/><span>Autoriser les citoyens à soutenir ce projet indépendamment de leur avis/vote</span></label>
        <div className="project-form__actions"><button type="button" className="secondary-action" onClick={()=>setEditor(null)}>Annuler</button><button type="submit" className="primary-action" disabled={saving}>{saving?"Enregistrement…":editor.is_published?"Enregistrer et publier":"Enregistrer le brouillon"}</button></div>
      </form></section></div>:null}

      {ideaEditor?<div className="project-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setIdeaEditor(null)}}><section className="project-modal" role="dialog" aria-modal="true" aria-labelledby="idea-editor-title"><div className="project-modal__head"><div><h3 id="idea-editor-title">Traiter {ideaEditor.reference}</h3><p>{ideaEditor.title}</p></div><button type="button" aria-label="Fermer" onClick={()=>setIdeaEditor(null)}>×</button></div><form className="project-form" onSubmit={saveIdea}><label><span>Statut</span><select value={ideaEditor.status} onChange={e=>setIdeaEditor(v=>({...v,status:e.target.value}))}>{Object.entries(IDEA_STATUS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label><span>Note de traitement</span><textarea value={ideaEditor.staffNote||""} onChange={e=>setIdeaEditor(v=>({...v,staffNote:e.target.value}))} placeholder="Décision ou commentaire de traitement…"/></label><div className="project-form__actions"><button type="button" className="secondary-action" onClick={()=>setIdeaEditor(null)}>Annuler</button><button type="submit" className="primary-action" disabled={saving}>{saving?"Enregistrement…":"Enregistrer le traitement"}</button></div></form></section></div>:null}
    </main>
  </div></div>;
}

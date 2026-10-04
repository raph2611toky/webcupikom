import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import PortalPagination from "../../components/ui/PortalPagination.jsx";
import { createAdminNews, deleteAdminNews, getAdminNews, getAdminNewsItem, unpublishAdminNews, updateAdminNews } from "../../api/news.js";
import { getApiErrorMessage } from "../../api/auth.js";

const EMPTY={
  title:"",
  category:"Information",
  excerpt:"",
  content:"",
  publication_type:"news",
  severity:"info",
  is_published:true,
  is_important:false,
  is_pinned:false,
  notify_residents:true,
  published_at:"",
  expires_at:"",
  target_districts:"",
  affected_areas:"",
  instructions:"",
};

const TYPE_LABELS={news:"Actualité",announcement:"Annonce",alert:"Alerte"};
const SEVERITY_LABELS={info:"Information",warning:"Avertissement",critical:"Critique"};

export default function AdminNews(){
  const [items,setItems]=useState([]);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState("Toutes");
  const [typeFilter,setTypeFilter]=useState("all");
  const [page,setPage]=useState(1);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState(EMPTY);
  const [saving,setSaving]=useState(false);

  async function load(){
    setLoading(true);setError("");
    try{setItems(await getAdminNews({page_size:100}))}
    catch(e){setError(getApiErrorMessage(e,"Impossible de charger les publications."))}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);

  const rows=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return items.filter(item=>{
      const state=filter==="Toutes"||(filter==="Publié"&&item.published)||(filter==="Brouillon"&&!item.published);
      const type=typeFilter==="all"||item.publicationType===typeFilter||item.publication_type===typeFilter;
      return state&&type&&(!q||`${item.title} ${item.category} ${item.excerpt}`.toLowerCase().includes(q));
    });
  },[items,query,filter,typeFilter]);

  const perPage=8;
  const totalPages=Math.max(1,Math.ceil(rows.length/perPage));
  const pageRows=rows.slice((page-1)*perPage,page*perPage);
  useEffect(()=>{setPage(1)},[query,filter,typeFilter]);
  useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages]);

  function openCreate(){setForm({...EMPTY});setModal({type:"create"});setNotice("")}
  async function openEdit(item){
    setSaving(true);setError("");setNotice("");
    try{
      const detail=await getAdminNewsItem(item.slug);
      setForm({
        title:detail.title||"",
        category:detail.category||"Information",
        excerpt:detail.excerpt||"",
        content:detail.body||detail.content||"",
        publication_type:detail.publicationType||detail.publication_type||"news",
        severity:detail.severity||"info",
        is_published:detail.published!==false,
        is_important:Boolean(detail.important||detail.is_important),
        is_pinned:Boolean(detail.pinned||detail.is_pinned),
        notify_residents:detail.notifyResidents!==false,
        published_at:detail.publishedAt?String(detail.publishedAt).slice(0,16):detail.published_at?String(detail.published_at).slice(0,16):"",
        expires_at:detail.expiresAt?String(detail.expiresAt).slice(0,16):detail.expires_at?String(detail.expires_at).slice(0,16):"",
        target_districts:(detail.targetDistricts||detail.target_districts||[]).join(", "),
        affected_areas:detail.affectedAreas||detail.affected_areas||"",
        instructions:detail.instructions||"",
      });
      setModal({type:"edit",item:detail});
    }catch(e){setError(getApiErrorMessage(e,"Impossible de charger cette publication."))}
    finally{setSaving(false)}
  }
  function patch(name,value){setForm(current=>({...current,[name]:value}))}
  async function save(e){
    e.preventDefault();setSaving(true);setError("");setNotice("");
    try{
      const saved=modal.type==="create"?await createAdminNews(form):await updateAdminNews(modal.item.slug,form);
      setModal(null);await load();
      setNotice(`${TYPE_LABELS[saved.publicationType]||"Publication"} enregistrée${saved.published?" et publiée":" en brouillon"}.`);
    }catch(err){setError(getApiErrorMessage(err,"Enregistrement impossible."))}
    finally{setSaving(false)}
  }
  async function unpublish(item){
    if(!window.confirm(`Dépublier « ${item.title} » ?`))return;
    try{await unpublishAdminNews(item.slug);setNotice("Publication repassée en brouillon.");await load()}
    catch(e){setError(getApiErrorMessage(e,"Impossible de dépublier cette publication."))}
  }
  async function remove(item){
    if(!window.confirm(`Supprimer définitivement « ${item.title} » ?`))return;
    try{await deleteAdminNews(item.slug);setNotice("Publication supprimée.");await load()}
    catch(e){setError(getApiErrorMessage(e,"Impossible de supprimer cette publication."))}
  }

  return <div className="portal-layout"><AdminSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Communication" title="Publications municipales" actions={<button className="topbar-cta" onClick={openCreate}>+ Nouvelle publication</button>}/>
    <main className="portal-content admin-publications-page">
      {error?<div className="error-card" role="alert">{error}</div>:null}
      {notice?<div className="success-inline" role="status">✓ {notice}</div>:null}

      <section className="portal-card admin-publication-intro">
        <div><strong>Actualités, annonces et alertes au même endroit</strong><p>Choisissez le type de publication lors de la création. Une alerte publiée devient immédiatement visible dans l’espace citoyen et dans l’icône Alertes.</p></div>
        <div className="admin-publication-counts">
          <span><b>{items.filter(i=>i.publicationType==="news").length}</b> actualités</span>
          <span><b>{items.filter(i=>i.publicationType==="announcement").length}</b> annonces</span>
          <span><b>{items.filter(i=>i.publicationType==="alert").length}</b> alertes</span>
        </div>
      </section>

      <section className="toolbar-card toolbar-card--stack">
        <div className="toolbar-line">
          <label className="portal-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher une publication" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher une publication..."/></label>
          <label><span className="sr-only">État</span><select aria-label="Filtrer par état" value={filter} onChange={e=>setFilter(e.target.value)}><option>Toutes</option><option>Publié</option><option>Brouillon</option></select></label>
          <label><span className="sr-only">Type</span><select aria-label="Filtrer par type" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">Tous les types</option><option value="news">Actualités</option><option value="announcement">Annonces</option><option value="alert">Alertes</option></select></label>
        </div>
      </section>

      <section className="portal-card">
        {loading?<div className="loading-card">Chargement…</div>:<div className="admin-news-list">
          {pageRows.map(n=><article key={n.slug}>
            <div>
              <div className="publication-admin-badges"><span className={`publication-type-chip type-${n.publicationType}`}>{TYPE_LABELS[n.publicationType]||"Publication"}</span>{n.publicationType==="alert"?<span className={`publication-severity severity-${n.severity}`}>{SEVERITY_LABELS[n.severity]||n.severity}</span>:null}{n.important?<span className="publication-important">Important</span>:null}</div>
              <h3>{n.title}</h3><p>{n.excerpt}</p>
            </div>
            <div><time>{n.date||"—"}</time><em>{n.published?"Publié":"Brouillon"}</em><button onClick={()=>openEdit(n)}>Modifier</button>{n.published?<button onClick={()=>unpublish(n)}>Dépublier</button>:null}<button className="text-danger" onClick={()=>remove(n)}>Supprimer</button></div>
          </article>)}
          {!rows.length?<div className="dashboard-empty">Aucune publication.</div>:null}
          {rows.length?<PortalPagination page={page} totalPages={totalPages} totalItems={rows.length} perPage={perPage} onPageChange={setPage} itemLabel="publication" itemLabelPlural="publications"/>:null}
        </div>}
      </section>

      {modal?<div className="modal-backdrop" onMouseDown={()=>!saving&&setModal(null)}>
        <form className="portal-modal management-modal publication-admin-modal" onMouseDown={e=>e.stopPropagation()} onSubmit={save}>
          <button type="button" className="modal-close" onClick={()=>setModal(null)}>×</button>
          <span className="section-label">{modal.type==="create"?"Créer":"Modifier"}</span>
          <h2>{modal.type==="create"?"Nouvelle publication":"Modifier la publication"}</h2>
          <div className="management-form-grid">
            <label className="span-2"><span>Titre</span><input value={form.title} onChange={e=>patch("title",e.target.value)} required/></label>
            <label><span>Type</span><select value={form.publication_type} onChange={e=>patch("publication_type",e.target.value)}><option value="news">Actualité</option><option value="announcement">Annonce</option><option value="alert">Alerte</option></select></label>
            <label><span>Catégorie</span><input value={form.category} onChange={e=>patch("category",e.target.value)}/></label>
            {form.publication_type==="alert"?<label><span>Gravité</span><select value={form.severity} onChange={e=>patch("severity",e.target.value)}><option value="info">Information</option><option value="warning">Avertissement</option><option value="critical">Critique</option></select></label>:null}
            <label><span>Date de publication</span><input type="datetime-local" value={form.published_at} onChange={e=>patch("published_at",e.target.value)}/></label>
            {form.publication_type==="alert"?<label><span>Expiration</span><input type="datetime-local" value={form.expires_at} onChange={e=>patch("expires_at",e.target.value)}/></label>:null}
            <label className="span-2"><span>Quartiers ciblés</span><input value={form.target_districts} onChange={e=>patch("target_districts",e.target.value)} placeholder="Nova Centre, District Orion"/></label>
            {form.publication_type==="alert"?<label className="span-2"><span>Zones affectées</span><input value={form.affected_areas} onChange={e=>patch("affected_areas",e.target.value)} placeholder="Ex. secteur du marché et rues voisines"/></label>:null}
            <label className="span-2"><span>Résumé</span><textarea rows="2" value={form.excerpt} onChange={e=>patch("excerpt",e.target.value)}/></label>
            <label className="span-2"><span>Contenu</span><textarea rows="5" value={form.content} onChange={e=>patch("content",e.target.value)} required/></label>
            {form.publication_type==="alert"?<label className="span-2"><span>Consignes aux habitants</span><textarea rows="3" value={form.instructions} onChange={e=>patch("instructions",e.target.value)} placeholder="Que doivent faire les habitants ?"/></label>:null}
            <div className="publication-admin-checks span-2">
              <label className="management-check"><input type="checkbox" checked={form.is_published} onChange={e=>patch("is_published",e.target.checked)}/><span>Publier</span></label>
              <label className="management-check"><input type="checkbox" checked={form.notify_residents} onChange={e=>patch("notify_residents",e.target.checked)}/><span>Notifier les habitants</span></label>
              <label className="management-check"><input type="checkbox" checked={form.is_important} onChange={e=>patch("is_important",e.target.checked)}/><span>Important</span></label>
              <label className="management-check"><input type="checkbox" checked={form.is_pinned} onChange={e=>patch("is_pinned",e.target.checked)}/><span>Épingler</span></label>
            </div>
          </div>
          <div className="management-modal__actions"><button type="button" className="secondary-action" onClick={()=>setModal(null)}>Annuler</button><button className="primary-action" disabled={saving}>{saving?"Enregistrement…":"Enregistrer"}</button></div>
        </form>
      </div>:null}
    </main>
  </div></div>;
}

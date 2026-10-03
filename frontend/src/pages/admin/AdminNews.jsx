import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { createAdminNews, getAdminNews, getAdminNewsItem, unpublishAdminNews, updateAdminNews } from "../../api/news.js";
import { getApiErrorMessage } from "../../api/auth.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const EMPTY={title:"",slug:"",category:"Information",excerpt:"",content:"",is_published:true,published_at:""};

export default function AdminNews(){
  const [items,setItems]=useState([]);
  const [query,setQuery]=useState("");
  const [viewFilter,setViewFilter]=useState("Toutes");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(EMPTY);
  const [saving,setSaving]=useState(false);

  async function load(){
    setLoading(true);setError("");
    try{setItems(await getAdminNews())}
    catch(e){setError(getApiErrorMessage(e,"Impossible de charger les actualités."))}
    finally{setLoading(false)}
  }

  useEffect(()=>{load()},[]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return items.filter(item=>{
      const matchesQuery=!q||`${item.title} ${item.category}`.toLowerCase().includes(q);
      const matchesFilter=viewFilter==="Toutes"||(viewFilter==="Publié"&&item.is_published!==false)||(viewFilter==="Brouillon"&&item.is_published===false)||item.category===viewFilter;
      return matchesQuery&&matchesFilter;
    });
  },[items,query,viewFilter]);

  function openCreate(){setForm(EMPTY);setEditing({type:"create"})}

  async function openEdit(item){
    setSaving(true);setError("");
    try{
      const detail=await getAdminNewsItem(item.slug);
      setForm({
        title:detail.title||"",
        slug:detail.slug||"",
        category:detail.category||"Information",
        excerpt:detail.excerpt||"",
        content:detail.content||detail.body||"",
        is_published:detail.is_published!==false,
        published_at:detail.published_at||"",
      });
      setEditing({type:"edit",article:detail});
    }catch(e){setError(getApiErrorMessage(e,"Impossible de charger cette actualité."))}
    finally{setSaving(false)}
  }

  function update(name,value){setForm(current=>({...current,[name]:value}))}

  async function save(event){
    event.preventDefault();setSaving(true);setError("");
    try{
      const payload={...form};
      if(!payload.published_at)delete payload.published_at;
      if(editing.type==="create")await createAdminNews(payload);
      else await updateAdminNews(editing.article.slug,payload);
      setEditing(null);await load();
    }catch(e){setError(getApiErrorMessage(e,"Enregistrement impossible."))}
    finally{setSaving(false)}
  }

  async function unpublish(item){
    if(!window.confirm(`Dépublier « ${item.title} » ?`))return;
    try{await unpublishAdminNews(item.slug);await load()}
    catch(e){setError(getApiErrorMessage(e,"Impossible de dépublier l’actualité."))}
  }

  return <div className="portal-layout">
    <AdminSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow="Communication municipale" title="Publications" actions={<button className="topbar-cta" onClick={openCreate}>+ Nouvelle publication</button>}/>
      <main className="portal-content management-page">
        {error?<div className="error-card" role="alert">{error}</div>:null}

        <section className="toolbar-card publication-toolbar">
          <div className="publication-toolbar__top">
            <label className="portal-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher une publication" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher une publication..."/></label>
            <span className="management-summary">{items.filter(i=>i.is_published!==false).length} publiées · {items.filter(i=>i.is_published===false).length} brouillon(s)</span>
          </div>
          <div className="management-filter-row">
            {["Toutes","Publié","Brouillon",...Array.from(new Set(items.map(i=>i.category).filter(Boolean)))].map(item=><button key={item} className={viewFilter===item?"is-active":""} aria-pressed={viewFilter===item} onClick={()=>setViewFilter(item)}>{item}</button>)}
          </div>
        </section>

        <section className="portal-card management-list">
          {loading?<div className="loading-card">Chargement…</div>:filtered.map(item=><article key={item.slug} className="management-row">
            <div className="management-row__main management-row__main--news">
              <div className="management-news-thumb"><img src={item.image} alt=""/></div>
              <div><span>{item.category||"Information"}</span><h3>{item.title}</h3><p>{item.excerpt}</p></div>
            </div>
            <div className="management-row__actions">
              <em className={`status-pill ${item.is_published!==false?"status-success":"status-warning"}`}>{item.is_published!==false?"Publié":"Brouillon"}</em>
              <button className="secondary-action" onClick={()=>openEdit(item)}>Modifier</button>
              {item.is_published!==false?<button className="text-danger" onClick={()=>unpublish(item)}>Dépublier</button>:null}
            </div>
          </article>)}
        </section>
      </main>

      {editing?<div className="modal-backdrop" onMouseDown={()=>!saving&&setEditing(null)}>
        <form className="portal-modal management-modal" onMouseDown={e=>e.stopPropagation()} onSubmit={save}>
          <button type="button" className="modal-close" onClick={()=>setEditing(null)} disabled={saving}>×</button>
          <div><span className="section-label">{editing.type==="create"?"Créer":"Modifier"}</span><h2>{editing.type==="create"?"Nouvelle publication":"Modifier la publication"}</h2></div>
          <div className="management-form-grid">
            <label className="span-2"><span>Titre</span><input value={form.title} onChange={e=>update("title",e.target.value)} required/></label>
            <label><span>Catégorie</span><input value={form.category} onChange={e=>update("category",e.target.value)}/></label>
            <label><span>Date de publication</span><input type="datetime-local" value={form.published_at?String(form.published_at).slice(0,16):""} onChange={e=>update("published_at",e.target.value)}/></label>
            <label className="span-2"><span>Résumé</span><textarea rows="2" value={form.excerpt} onChange={e=>update("excerpt",e.target.value)}/></label>
            <label className="span-2"><span>Contenu</span><textarea rows="6" value={form.content} onChange={e=>update("content",e.target.value)} required/></label>
            <label className="management-check span-2"><input type="checkbox" checked={form.is_published} onChange={e=>update("is_published",e.target.checked)}/><span>Publier</span></label>
          </div>
          <div className="management-modal__actions">
            <button type="button" className="secondary-action" onClick={()=>setEditing(null)}>Annuler</button>
            <button className="primary-action" disabled={saving}>{saving?"Enregistrement…":"Enregistrer"}</button>
          </div>
        </form>
      </div>:null}
    </div>
  </div>;
}

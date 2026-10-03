import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { createAdminNews, getAdminNews, getAdminNewsItem, unpublishAdminNews, updateAdminNews } from "../../api/news.js";
import { getApiErrorMessage } from "../../api/auth.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const EMPTY={title:"",category:"Information",excerpt:"",content:"",is_published:true,published_at:""};

export default function AdminNews(){
  const [items,setItems]=useState([]);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState("Toutes");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState(EMPTY);
  const [saving,setSaving]=useState(false);

  async function load(){
    setLoading(true);setError("");
    try{setItems(await getAdminNews())}
    catch(e){setError(getApiErrorMessage(e,"Impossible de charger les actualités."))}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);

  const rows=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return items.filter(item=>{
      const state=filter==="Toutes"||(filter==="Publié"&&item.published)||(filter==="Brouillon"&&!item.published);
      return state&&(!q||`${item.title} ${item.category}`.toLowerCase().includes(q));
    });
  },[items,query,filter]);

  function openCreate(){setForm(EMPTY);setModal({type:"create"})}
  async function openEdit(item){
    setSaving(true);setError("");
    try{
      const detail=await getAdminNewsItem(item.slug);
      setForm({
        title:detail.title||"",category:detail.category||"Information",excerpt:detail.excerpt||"",
        content:detail.body||detail.content||"",is_published:detail.published!==false,
        published_at:detail.published_at?String(detail.published_at).slice(0,16):""
      });
      setModal({type:"edit",item:detail});
    }catch(e){setError(getApiErrorMessage(e,"Impossible de charger cette publication."))}
    finally{setSaving(false)}
  }
  function patch(name,value){setForm(current=>({...current,[name]:value}))}
  async function save(e){
    e.preventDefault();setSaving(true);setError("");
    try{
      if(modal.type==="create")await createAdminNews(form);
      else await updateAdminNews(modal.item.slug,form);
      setModal(null);await load();
    }catch(err){setError(getApiErrorMessage(err,"Enregistrement impossible."))}
    finally{setSaving(false)}
  }
  async function unpublish(item){
    if(!window.confirm(`Dépublier « ${item.title} » ?`))return;
    try{await unpublishAdminNews(item.slug);await load()}
    catch(e){setError(getApiErrorMessage(e,"Impossible de dépublier cette actualité."))}
  }

  return <div className="portal-layout"><AdminSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Communication" title="Actualités" actions={<button className="topbar-cta" onClick={openCreate}>+ Nouvelle publication</button>}/>
    <main className="portal-content">
      {error?<div className="error-card" role="alert">{error}</div>:null}
      <section className="toolbar-card">
        <div className="toolbar-line">
          <label className="portal-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher une publication" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher une publication..."/></label>
          <label><span className="sr-only">Filtrer les publications</span><select aria-label="Filtrer les publications" value={filter} onChange={e=>setFilter(e.target.value)}><option>Toutes</option><option>Publié</option><option>Brouillon</option></select></label>
        </div>
      </section>

      <section className="portal-card">
        {loading?<div className="loading-card">Chargement…</div>:<div className="admin-news-list">
          {rows.map(n=><article key={n.slug}>
            <div><span>{n.category}</span><h3>{n.title}</h3><p>{n.excerpt}</p></div>
            <div><time>{n.date||"—"}</time><em>{n.published?"Publié":"Brouillon"}</em><button onClick={()=>openEdit(n)}>Modifier</button>{n.published?<button className="text-danger" onClick={()=>unpublish(n)}>Dépublier</button>:null}</div>
          </article>)}
          {!rows.length?<div className="dashboard-empty">Aucune publication.</div>:null}
        </div>}
      </section>

      {modal?<div className="modal-backdrop" onMouseDown={()=>!saving&&setModal(null)}>
        <form className="portal-modal management-modal" onMouseDown={e=>e.stopPropagation()} onSubmit={save}>
          <button type="button" className="modal-close" onClick={()=>setModal(null)}>×</button>
          <span className="section-label">{modal.type==="create"?"Créer":"Modifier"}</span>
          <h2>{modal.type==="create"?"Nouvelle publication":"Modifier la publication"}</h2>
          <div className="management-form-grid">
            <label className="span-2"><span>Titre</span><input value={form.title} onChange={e=>patch("title",e.target.value)} required/></label>
            <label><span>Catégorie</span><input value={form.category} onChange={e=>patch("category",e.target.value)}/></label>
            <label><span>Date de publication</span><input type="datetime-local" value={form.published_at} onChange={e=>patch("published_at",e.target.value)}/></label>
            <label className="span-2"><span>Résumé</span><textarea rows="2" value={form.excerpt} onChange={e=>patch("excerpt",e.target.value)}/></label>
            <label className="span-2"><span>Contenu</span><textarea rows="5" value={form.content} onChange={e=>patch("content",e.target.value)} required/></label>
            <label className="management-check span-2"><input type="checkbox" checked={form.is_published} onChange={e=>patch("is_published",e.target.checked)}/><span>Publier</span></label>
          </div>
          <div className="management-modal__actions"><button type="button" className="secondary-action" onClick={()=>setModal(null)}>Annuler</button><button className="primary-action" disabled={saving}>{saving?"Enregistrement…":"Enregistrer"}</button></div>
        </form>
      </div>:null}
    </main>
  </div></div>;
}

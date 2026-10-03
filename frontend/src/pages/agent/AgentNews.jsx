import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { createNews, deleteNews, getNews, updateNews } from "../../api/news.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const EMPTY = {
  title:"",
  image:"",
  category:"Information",
  kind:"Information pratique",
  audience:"Tous les habitants",
  excerpt:"",
  body:"",
  published:true,
};

export default function AgentNews(){
  const [items,setItems]=useState([]);
  const [query,setQuery]=useState("");
  const [viewFilter,setViewFilter]=useState("Toutes");
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(EMPTY);

  const load=()=>getNews({publishedOnly:false}).then(setItems);
  useEffect(()=>{load()},[]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return items.filter((item)=>{
      const matchesQuery=!q||`${item.title} ${item.category} ${item.kind}`.toLowerCase().includes(q);
      const matchesFilter =
        viewFilter==="Toutes" ||
        (viewFilter==="Publié" && item.published) ||
        (viewFilter==="Brouillon" && !item.published) ||
        item.kind===viewFilter;
      return matchesQuery && matchesFilter;
    });
  },[items,query,viewFilter]);

  const openCreate=()=>{setEditing("new");setForm(EMPTY)};
  const readImage=(file)=>{if(!file)return;const reader=new FileReader();reader.onload=()=>setForm(current=>({...current,image:String(reader.result||"")}));reader.readAsDataURL(file)};
  const openEdit=(item)=>{setEditing(item.id);setForm({...item})};
  const save=async(e)=>{
    e.preventDefault();
    if(!form.title.trim()) return;
    if(editing==="new") await createNews(form);
    else await updateNews(editing,form);
    setEditing(null); setForm(EMPTY); load();
  };
  const toggle=async(item)=>{await updateNews(item.id,{published:!item.published});load()};
  const remove=async(item)=>{if(window.confirm(`Supprimer « ${item.title} » ?`)){await deleteNews(item.id);load()}};

  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Communication municipale" title="Publications" actions={<button className="topbar-cta" onClick={openCreate}>+ Nouvelle publication</button>}/>
    <main className="portal-content management-page">
      <section className="toolbar-card publication-toolbar">
        <div className="publication-toolbar__top">
          <label className="portal-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher une publication..." /></label>
          <span className="management-summary">{items.filter(i=>i.published).length} publiées · {items.filter(i=>!i.published).length} brouillon(s)</span>
        </div>
        <div className="management-filter-row" aria-label="Filtrer les publications">
          {["Toutes","Publié","Brouillon","Annonce municipale","Changement de service","Information pratique"].map((item)=>
            <button key={item} className={viewFilter===item?"is-active":""} onClick={()=>setViewFilter(item)}>{item}</button>
          )}
        </div>
      </section>
      <section className="portal-card management-list">
        {filtered.map(item=><article key={item.id} className="management-row">
          <div className="management-row__main management-row__main--news">
            <div className="management-news-thumb">{item.image ? <img src={item.image} alt="" /> : <span>{item.kind==="Annonce municipale"?"!":"▤"}</span>}</div>
            <div><span>{item.category} · {item.audience}</span><h3>{item.title}</h3><p>{item.excerpt}</p></div>
          </div>
          <div className="management-row__actions">
            <em className={`status-pill ${item.published?"status-success":"status-warning"}`}>{item.published?"Publié":"Brouillon"}</em>
            <button className="secondary-action" onClick={()=>toggle(item)}>{item.published?"Retirer":"Publier"}</button>
            <button className="secondary-action" onClick={()=>openEdit(item)}>Modifier</button>
            <button className="text-danger" onClick={()=>remove(item)}>Supprimer</button>
          </div>
        </article>)}
        {!filtered.length?<div className="dashboard-empty">Aucune publication trouvée.</div>:null}
      </section>
    </main>

    {editing ? <div className="modal-backdrop" onMouseDown={()=>setEditing(null)}>
      <form className="portal-modal management-modal" onMouseDown={e=>e.stopPropagation()} onSubmit={save}>
        <button type="button" className="modal-close" onClick={()=>setEditing(null)}>×</button>
        <div><span className="section-label">{editing==="new"?"Créer":"Modifier"}</span><h2>{editing==="new"?"Nouvelle publication":"Modifier la publication"}</h2></div>
        <div className="management-form-grid">
          <label className="span-2"><span>Titre</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required /></label>
          <div className="span-2 management-image-field">
            <span>Image de la publication</span>
            <div className="management-image-upload">
              {form.image ? <img src={form.image} alt="" /> : <div>▧</div>}
              <label className="secondary-action"><input hidden type="file" accept="image/*" onChange={e=>readImage(e.target.files?.[0])}/>{form.image ? "Changer l’image" : "Ajouter une image"}</label>
              {form.image ? <button type="button" className="text-danger" onClick={()=>setForm({...form,image:""})}>Retirer</button> : null}
            </div>
          </div>
          <label><span>Type</span><select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})}><option>Annonce municipale</option><option>Changement de service</option><option>Information pratique</option></select></label>
          <label><span>Catégorie</span><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option>Important</option><option>Administration</option><option>Transport</option><option>Énergie</option><option>Santé</option><option>Information</option></select></label>
          <label className="span-2"><span>Public concerné</span><select value={form.audience} onChange={e=>setForm({...form,audience:e.target.value})}><option>Tous les habitants</option><option>Citoyens connectés</option><option>Agents municipaux</option></select></label>
          <label className="span-2"><span>Résumé</span><textarea rows="2" value={form.excerpt} onChange={e=>setForm({...form,excerpt:e.target.value})} /></label>
          <label className="span-2"><span>Contenu</span><textarea rows="4" value={form.body} onChange={e=>setForm({...form,body:e.target.value})} /></label>
          <label className="management-check span-2"><input type="checkbox" checked={form.published} onChange={e=>setForm({...form,published:e.target.checked})}/><span>Publier immédiatement</span></label>
        </div>
        <div className="management-modal__actions"><button type="button" className="secondary-action" onClick={()=>setEditing(null)}>Annuler</button><button className="primary-action">Enregistrer</button></div>
      </form>
    </div>:null}
  </div></div>;
}

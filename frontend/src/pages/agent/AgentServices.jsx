import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getServices, updateService } from "../../api/services.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";


export default function AgentServices(){
  const [items,setItems]=useState([]);
  const [query,setQuery]=useState("");
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(null);
  const [actionsText,setActionsText]=useState("");
  const [documentsText,setDocumentsText]=useState("");

  const load=()=>getServices({publishedOnly:false}).then(setItems);
  useEffect(()=>{load()},[]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return items.filter(item=>!q||`${item.name} ${item.category} ${item.shortDescription}`.toLowerCase().includes(q));
  },[items,query]);

  const openEdit=(item)=>{
    setEditing(item.id);setForm({...item});
    setActionsText((item.actions||[]).join("\n"));
    setDocumentsText((item.requiredDocuments||[]).join("\n"));
  };
  const save=async(e)=>{
    e.preventDefault();
    if(!form.name.trim()) return;
    const payload={...form,
      actions:actionsText.split("\n").map(v=>v.trim()).filter(Boolean),
      requiredDocuments:documentsText.split("\n").map(v=>v.trim()).filter(Boolean),
    };
    await updateService(editing,payload);
    setEditing(null);load();
  };

  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Catalogue municipal" title="Services municipaux" />
    <main className="portal-content management-page">
      <section className="toolbar-card">
        <label className="portal-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un service..." /></label>
        <span className="management-summary">{items.filter(i=>i.published).length} visibles aux habitants</span>
      </section>
      <section className="portal-card management-list">
        {filtered.map(item=><article key={item.id} className="management-row">
          <div className="management-row__main">
            <div className="service-admin-icon">{item.icon}</div>
            <div><span>{item.category}</span><h3>{item.name}</h3><p>{item.shortDescription}</p></div>
          </div>
          <div className="management-row__meta"><span>{item.openingHours||"Horaires à compléter"}</span><span>{item.phone||"Téléphone à compléter"}</span></div>
          <div className="management-row__actions">
            <em className={`status-pill ${item.published?"status-success":"status-warning"}`}>{item.published?"Visible":"Masqué"}</em>
            <button className="secondary-action" onClick={()=>openEdit(item)}>Modifier les informations →</button>
          </div>
        </article>)}
      </section>
    </main>

    {editing && form ? <div className="modal-backdrop" onMouseDown={()=>setEditing(null)}>
      <form className="portal-modal management-modal management-modal--service" onMouseDown={e=>e.stopPropagation()} onSubmit={save}>
        <button type="button" className="modal-close" onClick={()=>setEditing(null)}>×</button>
        <div><span className="section-label">Mettre à jour</span><h2>Informations du service</h2></div>
        <div className="management-form-grid">
          <label><span>Nom</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /></label>
          <label><span>Catégorie</span><input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} /></label>
          <label className="span-2"><span>Description courte</span><input value={form.shortDescription} onChange={e=>setForm({...form,shortDescription:e.target.value})} /></label>
          <label className="span-2"><span>Présentation</span><textarea rows="3" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></label>
          <label><span>Horaires</span><input value={form.openingHours} onChange={e=>setForm({...form,openingHours:e.target.value})} /></label>
          <label><span>Téléphone</span><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></label>
          <label><span>E-mail</span><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></label>
          <label><span>Adresse</span><input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} /></label>
          <label><span>Démarches disponibles <em>une par ligne</em></span><textarea rows="3" value={actionsText} onChange={e=>setActionsText(e.target.value)} /></label>
          <label><span>Documents nécessaires <em>un par ligne</em></span><textarea rows="3" value={documentsText} onChange={e=>setDocumentsText(e.target.value)} /></label>
        </div>
        <div className="management-modal__actions"><button type="button" className="secondary-action" onClick={()=>setEditing(null)}>Annuler</button><button className="primary-action">Enregistrer</button></div>
      </form>
    </div>:null}
  </div></div>;
}

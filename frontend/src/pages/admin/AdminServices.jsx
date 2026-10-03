import { useEffect, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { createService, getServices, updateService } from "../../api/services.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const EMPTY={
  icon:"◇",name:"",category:"Administration",shortDescription:"",description:"",
  openingHours:"",phone:"",email:"",address:"",actions:[],requiredDocuments:[],faq:[],published:true,sortOrder:0
};

export default function AdminServices(){
  const [items,setItems]=useState([]);
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(EMPTY);
  const [actionsText,setActionsText]=useState("");
  const [documentsText,setDocumentsText]=useState("");

  const load=()=>getServices({publishedOnly:false}).then(setItems);
  useEffect(()=>{load()},[]);

  const openCreate=()=>{setEditing("new");setForm(EMPTY);setActionsText("");setDocumentsText("")};
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
    if(editing==="new") await createService(payload);
    else await updateService(editing,payload);
    setEditing(null);load();
  };
  const toggle=async(item)=>{await updateService(item.id,{published:!item.published});load()};

  return <div className="portal-layout"><AdminSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Catalogue municipal" title="Services municipaux" actions={<button className="topbar-cta" onClick={openCreate}>+ Nouveau service</button>}/>
    <main className="portal-content management-page">
      <section className="portal-card management-list">
        {items.map(item=><article key={item.id} className="management-row">
          <div className="management-row__main">
            <div className="service-admin-icon">{item.icon}</div>
            <div><span>{item.category}</span><h3>{item.name}</h3><p>{item.shortDescription}</p></div>
          </div>
          <div className="management-row__meta"><span>{item.openingHours||"Horaires à compléter"}</span><span>{item.phone||"Téléphone à compléter"}</span></div>
          <div className="management-row__actions">
            <em className={`status-pill ${item.published?"status-success":"status-warning"}`}>{item.published?"Visible":"Masqué"}</em>
            <button className="secondary-action" onClick={()=>toggle(item)}>{item.published?"Masquer":"Publier"}</button>
            <button className="secondary-action" onClick={()=>openEdit(item)}>Modifier</button>
          </div>
        </article>)}
      </section>
    </main>

    {editing ? <div className="modal-backdrop" onMouseDown={()=>setEditing(null)}>
      <form className="portal-modal management-modal management-modal--service" onMouseDown={e=>e.stopPropagation()} onSubmit={save}>
        <button type="button" className="modal-close" onClick={()=>setEditing(null)}>×</button>
        <div><span className="section-label">{editing==="new"?"Créer":"Mettre à jour"}</span><h2>{editing==="new"?"Nouveau service":"Informations du service"}</h2></div>
        <div className="management-form-grid">
          <label><span>Nom</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /></label>
          <label><span>Catégorie</span><input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} /></label>
          <label className="span-2"><span>Description courte</span><input value={form.shortDescription} onChange={e=>setForm({...form,shortDescription:e.target.value})} /></label>
          <label className="span-2"><span>Présentation</span><textarea rows="3" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></label>
          <label><span>Horaires</span><input value={form.openingHours} onChange={e=>setForm({...form,openingHours:e.target.value})} /></label><label><span>Priorité d’affichage <em>0 = premier</em></span><input type="number" min="0" value={form.sortOrder ?? 0} onChange={e=>setForm({...form,sortOrder:Number(e.target.value)})} /></label>
          <label><span>Téléphone</span><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></label>
          <label><span>E-mail</span><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></label>
          <label><span>Adresse</span><input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} /></label>
          <label><span>Démarches disponibles <em>une par ligne</em></span><textarea rows="3" value={actionsText} onChange={e=>setActionsText(e.target.value)} /></label>
          <label><span>Documents nécessaires <em>un par ligne</em></span><textarea rows="3" value={documentsText} onChange={e=>setDocumentsText(e.target.value)} /></label>
          <label className="management-check span-2"><input type="checkbox" checked={form.published} onChange={e=>setForm({...form,published:e.target.checked})}/><span>Visible pour les habitants</span></label>
        </div>
        <div className="management-modal__actions"><button type="button" className="secondary-action" onClick={()=>setEditing(null)}>Annuler</button><button className="primary-action">Enregistrer</button></div>
      </form>
    </div>:null}
  </div></div>;
}

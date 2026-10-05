import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import PortalPagination from "../../components/ui/PortalPagination.jsx";
import { ServiceAvailabilityBadge } from "../../components/ui/ServiceAvailability.jsx";
import ServiceAvailabilityEditor from "../../components/ui/ServiceAvailabilityEditor.jsx";
import { createService, getServices, updateService } from "../../api/services.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";

const EMPTY={icon:"◇",name:"",category:"Administration",shortDescription:"",description:"",openingHours:"",phone:"",email:"",address:"",actions:[],requiredDocuments:[],faq:[],published:true,sortOrder:0,isFeatured:false,priorityOrder:0};

export default function AdminServices(){
  const [items,setItems]=useState([]);
  const [editing,setEditing]=useState(null);
  const [availabilityEditing,setAvailabilityEditing]=useState(null);
  const [form,setForm]=useState(EMPTY);
  const [actionsText,setActionsText]=useState("");
  const [documentsText,setDocumentsText]=useState("");
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState("all");
  const [page,setPage]=useState(1);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const load=()=>getServices({publishedOnly:false}).then(setItems).catch(e=>setError(getApiErrorMessage(e,"Impossible de charger les services.")));
  useEffect(()=>{load()},[]);

  const filtered=useMemo(()=>items.filter(item=>{
    const status=filter==="all"||(filter==="available"?item.isAvailable!==false:item.isAvailable===false);
    const term=query.trim().toLowerCase();
    return status&&(!term||`${item.name} ${item.category} ${item.unavailabilityReason||""}`.toLowerCase().includes(term));
  }),[items,query,filter]);
  const unavailableCount=items.filter(item=>item.isAvailable===false).length;
  const perPage=8;
  const totalPages=Math.max(1,Math.ceil(filtered.length/perPage));
  const pageItems=filtered.slice((page-1)*perPage,page*perPage);
  useEffect(()=>setPage(1),[query,filter]);

  const openCreate=()=>{setEditing("new");setForm(EMPTY);setActionsText("");setDocumentsText("");setError("")};
  const openEdit=(item)=>{setEditing(item.id);setForm({...item});setActionsText((item.actions||[]).join("\n"));setDocumentsText((item.requiredDocuments||[]).join("\n"));setError("")};

  const save=async(e)=>{
    e.preventDefault();
    if(!form.name.trim())return;
    setError("");setNotice("");
    const payload={...form,actions:actionsText.split("\n").map(v=>v.trim()).filter(Boolean),requiredDocuments:documentsText.split("\n").map(v=>v.trim()).filter(Boolean)};
    try{
      if(editing==="new")await createService(payload); else await updateService(editing,payload);
      setEditing(null);setNotice(editing==="new"?"Service créé.":"Informations du service mises à jour.");await load();
    }catch(err){setError(getApiErrorMessage(err,"Impossible d’enregistrer le service."))}
  };

  return <div className="portal-layout"><AdminSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Catalogue municipal" title="Services municipaux" actions={<div className="topbar-action-group"><button className="topbar-ghost" onClick={()=>navigate("/admin/service-usage")}>Analyse d’usage</button><button className="topbar-cta" onClick={openCreate}>+ Nouveau service</button></div>}/>
    <main className="portal-content management-page service-management-page">
      {error?<div className="error-card" role="alert">{error}</div>:null}{notice?<div className="success-inline" role="status">✓ {notice}</div>:null}
      <section className="service-management-summary">
        <div><strong>{items.length}</strong><span>services</span></div><div className={unavailableCount?"is-warning":""}><strong>{unavailableCount}</strong><span>indisponible{unavailableCount>1?"s":""}</span></div>
        <label className="portal-search"><span aria-hidden="true">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un service"/></label>
        <div className="service-management-filters"><button className={filter==="all"?"is-active":""} onClick={()=>setFilter("all")}>Tous</button><button className={filter==="available"?"is-active":""} onClick={()=>setFilter("available")}>Disponibles</button><button className={filter==="unavailable"?"is-active":""} onClick={()=>setFilter("unavailable")}>Indisponibles</button></div>
      </section>

      <section className="portal-card management-list service-management-list">
        {pageItems.map(item=><article key={item.id||item.slug} className={`management-row service-management-row ${item.isAvailable===false?"is-unavailable":""}`}>
          <div className="management-row__main"><div className="service-admin-icon">{item.icon}</div><div><span>{item.category}</span><h3>{item.name}</h3><p>{item.isAvailable===false?(item.unavailabilityReason||"Interruption connue"):item.shortDescription}</p></div></div>
          <div className="management-row__meta"><ServiceAvailabilityBadge service={item}/><span>{item.openingHours||"Horaires à compléter"}</span></div>
          <div className="management-row__actions"><button className="secondary-action" onClick={()=>setAvailabilityEditing(item)}>Disponibilité</button><button className="secondary-action" onClick={()=>openEdit(item)}>Modifier</button></div>
        </article>)}
        {filtered.length?<PortalPagination page={page} totalPages={totalPages} totalItems={filtered.length} perPage={perPage} onPageChange={setPage} itemLabel="service" itemLabelPlural="services"/>:null}
      </section>
    </main>

    {editing?<div className="modal-backdrop" onMouseDown={()=>setEditing(null)}><form className="portal-modal management-modal management-modal--service" onMouseDown={e=>e.stopPropagation()} onSubmit={save}>
      <button type="button" className="modal-close" onClick={()=>setEditing(null)}>×</button><div><span className="section-label">{editing==="new"?"Créer":"Mettre à jour"}</span><h2>{editing==="new"?"Nouveau service":"Informations du service"}</h2></div>
      <div className="management-form-grid">
        <label><span>Nom</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label><label><span>Catégorie</span><input value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label>
        <label className="span-2"><span>Description courte</span><input value={form.shortDescription} onChange={e=>setForm({...form,shortDescription:e.target.value})} required/></label><label className="span-2"><span>Présentation</span><textarea rows="3" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
        <label><span>Horaires</span><input value={form.openingHours} onChange={e=>setForm({...form,openingHours:e.target.value})}/></label><label><span>Ordre d’affichage</span><input type="number" min="0" value={form.sortOrder??0} onChange={e=>setForm({...form,sortOrder:Number(e.target.value)})}/></label>
        <label><span>Téléphone</span><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label><span>E-mail</span><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
        <label className="span-2"><span>Adresse</span><input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
        <label><span>Démarches disponibles <em>une par ligne</em></span><textarea rows="3" value={actionsText} onChange={e=>setActionsText(e.target.value)}/></label><label><span>Documents nécessaires <em>un par ligne</em></span><textarea rows="3" value={documentsText} onChange={e=>setDocumentsText(e.target.value)}/></label>
        <label className="management-check"><input type="checkbox" checked={Boolean(form.isFeatured)} onChange={e=>setForm({...form,isFeatured:e.target.checked})}/><span>Mettre en avant</span></label><label className="management-check"><input type="checkbox" checked={form.published!==false} onChange={e=>setForm({...form,published:e.target.checked})}/><span>Service actif</span></label>
      </div>
      <p className="field-help">L’interruption temporaire se gère séparément avec le bouton « Disponibilité » afin d’afficher un motif, une alternative et un retour estimé aux citoyens.</p>
      <div className="management-modal__actions"><button type="button" className="secondary-action" onClick={()=>setEditing(null)}>Annuler</button><button className="primary-action">Enregistrer</button></div>
    </form></div>:null}

    {availabilityEditing?<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setAvailabilityEditing(null)}}><section className="portal-modal service-availability-modal" role="dialog" aria-modal="true" aria-labelledby="admin-service-availability-title"><button type="button" className="modal-close" onClick={()=>setAvailabilityEditing(null)}>×</button><div><span className="section-label">Disponibilité publique</span><h2 id="admin-service-availability-title">{availabilityEditing.name}</h2></div><ServiceAvailabilityEditor service={availabilityEditing} role="admin" onSaved={updated=>{setAvailabilityEditing(updated);setItems(rows=>rows.map(row=>row.slug===updated.slug?updated:row));setNotice("Disponibilité du service mise à jour.")}}/></section></div>:null}
  </div></div>;
}

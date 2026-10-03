import { useEffect, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { createAdminService, disableAdminService, getAdminService, getAdminServices, updateAdminService } from "../../api/services.js";
import { getApiErrorMessage } from "../../api/auth.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const EMPTY={name:"",slug:"",category:"",short_description:"",description:"",opening_hours:"",phone:"",email:"",address:"",is_active:true,sort_order:0};

export default function AdminServices(){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(EMPTY);
  const [saving,setSaving]=useState(false);

  async function load(){
    setLoading(true);setError("");
    try{setItems(await getAdminServices())}
    catch(e){setError(getApiErrorMessage(e,"Impossible de charger les services."))}
    finally{setLoading(false)}
  }

  useEffect(()=>{load()},[]);

  function openCreate(){setForm(EMPTY);setEditing({type:"create"})}

  async function openEdit(item){
    setSaving(true);setError("");
    try{
      const detail=await getAdminService(item.slug);
      setForm({
        name:detail.name||"",
        slug:detail.slug||"",
        category:detail.category||"",
        short_description:detail.short_description||detail.shortDescription||"",
        description:detail.description||"",
        opening_hours:detail.opening_hours||detail.openingHours||"",
        phone:detail.phone||"",
        email:detail.email||"",
        address:detail.address||"",
        is_active:detail.is_active!==false,
        sort_order:Number(detail.sort_order??detail.sortOrder??0),
      });
      setEditing({type:"edit",service:detail});
    }catch(e){setError(getApiErrorMessage(e,"Impossible de charger ce service."))}
    finally{setSaving(false)}
  }

  function update(name,value){setForm(current=>({...current,[name]:value}))}

  async function save(event){
    event.preventDefault();setSaving(true);setError("");
    try{
      if(editing.type==="create") await createAdminService(form);
      else await updateAdminService(editing.service.slug,form);
      setEditing(null);await load();
    }catch(e){setError(getApiErrorMessage(e,"Enregistrement impossible."))}
    finally{setSaving(false)}
  }

  async function disable(item){
    if(!window.confirm(`Désactiver le service « ${item.name} » ?`))return;
    try{await disableAdminService(item.slug);await load()}
    catch(e){setError(getApiErrorMessage(e,"Impossible de désactiver le service."))}
  }

  return <div className="portal-layout">
    <AdminSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow="Catalogue municipal" title="Services municipaux" actions={<button className="topbar-cta" onClick={openCreate}>+ Nouveau service</button>}/>
      <main className="portal-content management-page">
        {error?<div className="error-card" role="alert">{error}</div>:null}

        <section className="portal-card management-list">
          {loading?<div className="loading-card">Chargement…</div>:items.map(item=><article key={item.slug} className="management-row">
            <div className="management-row__main">
              <div className="service-admin-icon">{item.icon}</div>
              <div><span>{item.category||"Service"}</span><h3>{item.name}</h3><p>{item.shortDescription}</p></div>
            </div>
            <div className="management-row__meta">
              <span>{item.openingHours||"Horaires à compléter"}</span>
              <span>Priorité d’affichage : {item.sortOrder??item.sort_order??0}</span>
            </div>
            <div className="management-row__actions">
              <em className={`status-pill ${item.is_active!==false?"status-success":"status-warning"}`}>{item.is_active!==false?"Actif":"Inactif"}</em>
              <button className="secondary-action" onClick={()=>openEdit(item)}>Modifier</button>
              {item.is_active!==false?<button className="text-danger" onClick={()=>disable(item)}>Désactiver</button>:null}
            </div>
          </article>)}
        </section>
      </main>

      {editing?<div className="modal-backdrop" onMouseDown={()=>!saving&&setEditing(null)}>
        <form className="portal-modal management-modal management-modal--service" onMouseDown={e=>e.stopPropagation()} onSubmit={save}>
          <button type="button" className="modal-close" onClick={()=>setEditing(null)} disabled={saving}>×</button>
          <div><span className="section-label">{editing.type==="create"?"Créer":"Mettre à jour"}</span><h2>{editing.type==="create"?"Nouveau service":form.name}</h2></div>

          <div className="management-form-grid">
            <label><span>Nom</span><input value={form.name} onChange={e=>update("name",e.target.value)} required/></label>
            <label><span>Catégorie</span><input value={form.category} onChange={e=>update("category",e.target.value)}/></label>
            <label className="span-2"><span>Description courte</span><input value={form.short_description} onChange={e=>update("short_description",e.target.value)} maxLength="280" required/></label>
            <label className="span-2"><span>Présentation</span><textarea rows="3" value={form.description} onChange={e=>update("description",e.target.value)}/></label>
            <label><span>Horaires</span><input value={form.opening_hours} onChange={e=>update("opening_hours",e.target.value)}/></label>
            <label><span>Priorité d’affichage <em>0 = premier</em></span><input type="number" min="0" value={form.sort_order} onChange={e=>update("sort_order",Number(e.target.value))}/></label>
            <label><span>Téléphone</span><input value={form.phone} onChange={e=>update("phone",e.target.value)}/></label>
            <label><span>E-mail</span><input type="email" value={form.email} onChange={e=>update("email",e.target.value)}/></label>
            <label className="span-2"><span>Adresse</span><input value={form.address} onChange={e=>update("address",e.target.value)}/></label>
            <label className="management-check span-2"><input type="checkbox" checked={form.is_active} onChange={e=>update("is_active",e.target.checked)}/><span>Service actif et visible</span></label>
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

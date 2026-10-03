import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { createAdminUser, getAdminUser, getAdminUsers, updateAdminUser } from "../../api/admin.js";
import { getApiErrorMessage } from "../../api/auth.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const EMPTY={email:"",password:"",first_name:"",last_name:"",phone_number:"",role:"citizen",locale:"fr",email_verified:true,is_active:true};

export default function AdminUsers(){
  const [items,setItems]=useState([]);
  const [q,setQ]=useState("");
  const [role,setRole]=useState("all");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState(EMPTY);
  const [saving,setSaving]=useState(false);

  async function load(){
    setLoading(true);setError("");
    try{setItems(await getAdminUsers())}
    catch(e){setError(getApiErrorMessage(e,"Impossible de charger les utilisateurs."))}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);

  const rows=useMemo(()=>items.filter(u=>(role==="all"||u.role===role)&&(!q||`${u.display_name||""} ${u.email} ${u.id}`.toLowerCase().includes(q.toLowerCase()))),[items,q,role]);

  function openCreate(){setForm(EMPTY);setModal({type:"create"})}
  async function openEdit(user){
    setSaving(true);setError("");
    try{
      const detail=await getAdminUser(user.id);
      setForm({
        first_name:detail.first_name||"",last_name:detail.last_name||"",phone_number:detail.phone_number||"",
        role:detail.role||"citizen",locale:detail.locale||"fr",email_verified:!!detail.email_verified,is_active:!!detail.is_active
      });
      setModal({type:"edit",user:detail});
    }catch(e){setError(getApiErrorMessage(e,"Impossible de charger cet utilisateur."))}
    finally{setSaving(false)}
  }
  function patch(name,value){setForm(current=>({...current,[name]:value}))}
  async function submit(e){
    e.preventDefault();setSaving(true);setError("");
    try{
      if(modal.type==="create")await createAdminUser(form);
      else await updateAdminUser(modal.user.id,form);
      setModal(null);await load();
    }catch(err){setError(getApiErrorMessage(err,"Enregistrement impossible."))}
    finally{setSaving(false)}
  }

  return <div className="portal-layout"><AdminSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Comptes" title="Utilisateurs" actions={<button className="topbar-cta" onClick={openCreate}>+ Ajouter</button>}/>
    <main className="portal-content">
      {error?<div className="error-card" role="alert">{error}</div>:null}
      <section className="toolbar-card">
        <div className="toolbar-line">
          <label className="portal-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher un utilisateur" value={q} onChange={e=>setQ(e.target.value)} placeholder="Nom, e-mail, identifiant..."/></label>
          <label><span className="sr-only">Filtrer par rôle</span><select aria-label="Filtrer par rôle" value={role} onChange={e=>setRole(e.target.value)}><option value="all">Tous</option><option value="citizen">Citoyen</option><option value="agent">Agent</option><option value="admin">Admin</option></select></label>
        </div>
      </section>

      <section className="portal-card">
        {loading?<div className="loading-card">Chargement…</div>:<div className="accessible-table-wrap"><table className="accessible-table">
          <caption className="sr-only">Liste des utilisateurs</caption>
          <thead><tr><th scope="col">Utilisateur</th><th scope="col">ID</th><th scope="col">Rôle</th><th scope="col">Statut</th><th scope="col">Actions</th></tr></thead>
          <tbody>{rows.map(u=><tr key={u.id}>
            <td><strong>{u.display_name||u.email}</strong><small>{u.email}</small></td>
            <td className="mono">#{u.id}</td><td>{u.role}</td>
            <td><span className={`status-pill ${u.is_active?"status-actif":"status-inactif"}`}>{u.is_active?"Actif":"Inactif"}</span></td>
            <td><button type="button" className="accessible-table__action" onClick={()=>openEdit(u)}>Modifier</button></td>
          </tr>)}</tbody>
        </table></div>}
      </section>

      {modal?<div className="modal-backdrop" onMouseDown={()=>!saving&&setModal(null)}>
        <form className="portal-modal" onMouseDown={e=>e.stopPropagation()} onSubmit={submit}>
          <button type="button" className="modal-close" onClick={()=>setModal(null)}>×</button>
          <span className="section-label">{modal.type==="create"?"Nouveau compte":"Modifier le compte"}</span>
          <h2>{modal.type==="create"?"Créer un utilisateur":modal.user.display_name||modal.user.email}</h2>
          {modal.type==="create"?<>
            <label><span>Email</span><input type="email" value={form.email} onChange={e=>patch("email",e.target.value)} required/></label>
            <label><span>Mot de passe</span><input type="password" value={form.password} onChange={e=>patch("password",e.target.value)} minLength="8" required/></label>
          </>:null}
          <div className="form-grid">
            <label><span>Prénom</span><input value={form.first_name} onChange={e=>patch("first_name",e.target.value)}/></label>
            <label><span>Nom</span><input value={form.last_name} onChange={e=>patch("last_name",e.target.value)}/></label>
          </div>
          <label><span>Téléphone</span><input value={form.phone_number} onChange={e=>patch("phone_number",e.target.value)}/></label>
          <label><span>Rôle</span><select value={form.role} onChange={e=>patch("role",e.target.value)}><option value="citizen">Citoyen</option><option value="agent">Agent</option><option value="admin">Administrateur</option></select></label>
          <div className="check-grid">
            <label className="compact-check"><input type="checkbox" checked={form.email_verified} onChange={e=>patch("email_verified",e.target.checked)}/> Email vérifié</label>
            <label className="compact-check"><input type="checkbox" checked={form.is_active} onChange={e=>patch("is_active",e.target.checked)}/> Compte actif</label>
          </div>
          <button className="primary-action" type="submit" disabled={saving}>{saving?"Enregistrement…":"Enregistrer"}</button>
        </form>
      </div>:null}
    </main>
  </div></div>;
}

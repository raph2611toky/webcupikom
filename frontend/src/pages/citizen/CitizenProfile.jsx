import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { updateProfile } from "../../api/account.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { setLocale } from "../../utils/i18n.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

function formatDate(value){
  if(!value)return "—";
  const d=new Date(value);
  return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"long",year:"numeric"}).format(d);
}

export default function CitizenProfile(){
  const { user, replaceUser }=useAuth();
  const [editing,setEditing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [status,setStatus]=useState(null);
  const [form,setForm]=useState({first_name:"",last_name:"",phone_number:"",locale:"fr"});

  useEffect(()=>{
    setForm({
      first_name:user?.first_name||"",
      last_name:user?.last_name||"",
      phone_number:user?.phone_number||"",
      locale:user?.locale||"fr",
    });
  },[user]);

  const completion=useMemo(()=>{
    const fields=[user?.first_name,user?.last_name,user?.email,user?.phone_number,user?.locale];
    return Math.round((fields.filter(Boolean).length/fields.length)*100);
  },[user]);

  const initials=((user?.first_name?.[0]||"")+(user?.last_name?.[0]||"")||"NT").toUpperCase();

  async function save(){
    if(!editing){setEditing(true);return}
    setSaving(true);
    setStatus(null);
    try{
      const next=await updateProfile(form);
      replaceUser(next);
      setLocale(next?.locale || form.locale);
      setEditing(false);
      setStatus({type:"success",message:"Profil mis à jour."});
    }catch(error){
      setStatus({type:"error",message:getApiErrorMessage(error,"Impossible de mettre à jour le profil.")});
    }finally{
      setSaving(false);
    }
  }

  function update(name,value){setForm(current=>({...current,[name]:value}))}

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow="Compte citoyen" title="Mon profil" actions={<button className="topbar-cta" onClick={save} disabled={saving}>{saving?"Enregistrement…":editing?"Enregistrer":"Modifier"}</button>}/>
      <main className="portal-content">
        {status?<div className={status.type==="error"?"error-card":"loading-card"} role={status.type==="error"?"alert":"status"}>{status.message}</div>:null}

        <section className="profile-hero">
          <div className="profile-avatar">{initials}</div>
          <div><span>Compte #{user?.id}</span><h2>{user?.display_name||user?.email}</h2><p>{user?.email} · rôle citoyen</p></div>
          <div className="profile-progress"><b>{completion}%</b><span>Profil complété</span></div>
        </section>

        <div className="profile-sections">
          <section className="portal-card">
            <div className="portal-card__head"><div><span className="section-label">Identité</span><h3>Informations personnelles</h3></div></div>
            <div className="profile-form-grid">
              <label><span>Prénom</span><input disabled={!editing} value={form.first_name} onChange={e=>update("first_name",e.target.value)}/></label>
              <label><span>Nom</span><input disabled={!editing} value={form.last_name} onChange={e=>update("last_name",e.target.value)}/></label>
            </div>
          </section>

          <section className="portal-card">
            <div className="portal-card__head"><div><span className="section-label">Contact</span><h3>Comment vous joindre</h3></div></div>
            <div className="profile-form-grid">
              <label><span>Email</span><input disabled value={user?.email||""}/></label>
              <label><span>Téléphone</span><input disabled={!editing} value={form.phone_number} onChange={e=>update("phone_number",e.target.value)} placeholder="+261..."/></label>
            </div>
          </section>

          <section className="portal-card">
            <div className="portal-card__head"><div><span className="section-label">Préférences</span><h3>Langue de l’interface</h3></div></div>
            <div className="profile-form-grid">
              <label><span>Langue</span><select disabled={!editing} value={form.locale} onChange={e=>update("locale",e.target.value)}><option value="fr">Français</option><option value="en">English</option></select></label>
              <label><span>Méthode de connexion</span><input disabled value={user?.auth_provider||"local"}/></label>
            </div>
            <p className="detail-copy">Cette préférence est utilisée dans la navigation et pour les contenus essentiels des services connus.</p>
          </section>

          <section className="portal-card">
            <div className="portal-card__head"><div><span className="section-label">Compte</span><h3>Informations système</h3></div></div>
            <div className="account-facts">
              <div><span>Identifiant</span><b>#{user?.id}</b></div>
              <div><span>Date d'inscription</span><b>{formatDate(user?.date_joined)}</b></div>
              <div><span>Email vérifié</span><b>{user?.email_verified?"Oui":"Non"}</b></div>
              <div><span>Statut</span><b>Actif</b></div>
            </div>
          </section>
        </div>
      </main>
    </div>
  </div>;
}

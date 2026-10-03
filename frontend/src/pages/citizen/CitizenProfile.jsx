import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { updateProfile } from "../../api/account.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { getLocale, setLocale, useLocale } from "../../utils/i18n.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const COPY={
  fr:{eyebrow:"Compte citoyen",title:"Mon profil",save:"Enregistrer",saving:"Enregistrement…",edit:"Modifier",updated:"Profil mis à jour.",error:"Impossible de mettre à jour le profil.",account:"Compte",citizen:"Compte citoyen",complete:"Profil complété",identity:"Identité",personal:"Informations personnelles",first:"Prénom",last:"Nom",contact:"Contact",reach:"Comment vous joindre",email:"Email",phone:"Téléphone",preferences:"Préférences",experience:"Votre expérience",language:"Langue",notifications:"Notifications",enabled:"Activées",system:"Informations système",citizenId:"Identifiant citoyen",verified:"Email vérifié",connection:"Connexion",status:"Statut",active:"Actif",yes:"Oui",no:"Non"},
  en:{eyebrow:"Citizen account",title:"My profile",save:"Save",saving:"Saving…",edit:"Edit",updated:"Profile updated.",error:"Unable to update the profile.",account:"Account",citizen:"Citizen account",complete:"Profile complete",identity:"Identity",personal:"Personal information",first:"First name",last:"Last name",contact:"Contact",reach:"How to reach you",email:"Email",phone:"Phone",preferences:"Preferences",experience:"Your experience",language:"Language",notifications:"Notifications",enabled:"Enabled",system:"System information",citizenId:"Citizen ID",verified:"Email verified",connection:"Sign-in",status:"Status",active:"Active",yes:"Yes",no:"No"},
  mg:{eyebrow:"Kaontin'ny mponina",title:"Ny mombamomba ahy",save:"Hitahiry",saving:"Mitahiry…",edit:"Hanova",updated:"Voaova ny mombamomba.",error:"Tsy afaka manavao ny mombamomba.",account:"Kaonty",citizen:"Kaontin'ny mponina",complete:"Mombamomba feno",identity:"Mombamomba",personal:"Fampahalalana manokana",first:"Anarana",last:"Fanampin'anarana",contact:"Fifandraisana",reach:"Fomba hifandraisana aminao",email:"Mailaka",phone:"Telefaona",preferences:"Safidy",experience:"Ny traikefanao",language:"Fiteny",notifications:"Fampahafantarana",enabled:"Mandeha",system:"Fampahalalana rafitra",citizenId:"ID mponina",verified:"Mailaka voamarina",connection:"Fidirana",status:"Sata",active:"Miasa",yes:"Eny",no:"Tsia"}
};

export default function CitizenProfile(){
  const {user,replaceUser}=useAuth();
  const [locale]=useLocale(); const copy=COPY[locale]||COPY.fr;
  const [editing,setEditing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [status,setStatus]=useState(null);
  const [form,setForm]=useState({first_name:"",last_name:"",phone_number:"",locale:getLocale()});

  useEffect(()=>{
    setForm({
      first_name:user?.first_name||"",
      last_name:user?.last_name||"",
      phone_number:user?.phone_number||"",
      locale:getLocale(),
    });
  },[user,locale]);

  const completion=useMemo(()=>{
    const fields=[user?.first_name,user?.last_name,user?.email,user?.phone_number,getLocale()];
    return Math.round((fields.filter(Boolean).length/fields.length)*100);
  },[user,locale]);

  const initials=((user?.first_name?.[0]||"")+(user?.last_name?.[0]||"")||"NT").toUpperCase();

  async function toggleEdit(){
    if(!editing){setEditing(true);return}
    setSaving(true);setStatus(null);
    try{
      const payload={
        first_name:form.first_name,
        last_name:form.last_name,
        phone_number:form.phone_number,
        ...(form.locale==="fr"||form.locale==="en"?{locale:form.locale}:{}),
      };
      const next=await updateProfile(payload);
      replaceUser(next);
      setLocale(form.locale);
      setEditing(false);
      setStatus({type:"success",message:copy.updated});
    }catch(error){
      setStatus({type:"error",message:getApiErrorMessage(error,copy.error)});
    }finally{setSaving(false)}
  }

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow={copy.eyebrow} title={copy.title} actions={<button className="topbar-cta" onClick={toggleEdit} disabled={saving}>{saving?copy.saving:editing?copy.save:copy.edit}</button>}/>
    <main className="portal-content">
      {status?<div className={status.type==="error"?"error-card":"success-inline"} role={status.type==="error"?"alert":"status"}>{status.message}</div>:null}
      <section className="profile-hero">
        <div className="profile-avatar">{initials}</div>
        <div><span>{copy.account} #{user?.id}</span><h2>{user?.display_name||user?.email}</h2><p>{user?.email} · {copy.citizen}</p></div>
        <div className="profile-progress"><b>{completion}%</b><span>{copy.complete}</span></div>
      </section>

      <div className="profile-sections">
        <section className="portal-card">
          <div className="portal-card__head"><div><span className="section-label">{copy.identity}</span><h3>{copy.personal}</h3></div></div>
          <div className="profile-form-grid">
            <label><span>{copy.first}</span><input disabled={!editing} value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/></label>
            <label><span>{copy.last}</span><input disabled={!editing} value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/></label>
          </div>
        </section>

        <section className="portal-card">
          <div className="portal-card__head"><div><span className="section-label">{copy.contact}</span><h3>{copy.reach}</h3></div></div>
          <div className="profile-form-grid">
            <label><span>{copy.email}</span><input disabled value={user?.email||""}/></label>
            <label><span>{copy.phone}</span><input disabled={!editing} value={form.phone_number} onChange={e=>setForm({...form,phone_number:e.target.value})} placeholder="+261..."/></label>
          </div>
        </section>

        <section className="portal-card">
          <div className="portal-card__head"><div><span className="section-label">{copy.preferences}</span><h3>{copy.experience}</h3></div></div>
          <div className="profile-form-grid">
            <label><span>{copy.language}</span><select disabled={!editing} value={form.locale} onChange={e=>setForm({...form,locale:e.target.value})}><option value="fr">Français</option><option value="en">English</option><option value="mg">Malagasy</option><option value="mg">Malagasy</option></select></label>
            <label><span>{copy.notifications}</span><input disabled value={copy.enabled}/></label>
          </div>
        </section>

        <section className="portal-card">
          <div className="portal-card__head"><div><span className="section-label">{copy.account}</span><h3>{copy.system}</h3></div></div>
          <div className="account-facts">
            <div><span>{copy.citizenId}</span><b>#{user?.id}</b></div>
            <div><span>{copy.verified}</span><b>{user?.email_verified?copy.yes:copy.no}</b></div>
            <div><span>{copy.connection}</span><b>{user?.auth_provider||"local"}</b></div>
            <div><span>{copy.status}</span><b>{copy.active}</b></div>
          </div>
        </section>
      </div>
    </main>
  </div></div>;
}

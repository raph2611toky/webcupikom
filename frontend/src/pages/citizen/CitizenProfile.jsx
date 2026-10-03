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
  fr:{eyebrow:"Compte citoyen",title:"Mon profil",save:"Enregistrer",saving:"Enregistrement…",edit:"Modifier",updated:"Profil mis à jour.",error:"Impossible de mettre à jour le profil.",account:"Compte",citizen:"Compte citoyen",complete:"Profil complété",identity:"Identité",personal:"Informations personnelles",first:"Prénom",last:"Nom",profession:"Profession",gender:"Genre",birth:"Date de naissance",female:"Femme",male:"Homme",other:"Autre",prefer:"Préfère ne pas préciser",contact:"Contact",reach:"Comment vous joindre",email:"Email",phone:"Téléphone",addressBlock:"Adresse",addressTitle:"Résidence et secteur",address:"Adresse",habitat:"Habitat / résidence",district:"Quartier / district",sector:"Secteur",street:"Rue",building:"Bâtiment",apartment:"Appartement",preferences:"Préférences",experience:"Votre expérience",language:"Langue",notifications:"Notifications",enabled:"Activées",system:"Informations système",citizenId:"Identifiant citoyen",verified:"Email vérifié",connection:"Connexion",status:"Statut",active:"Actif",yes:"Oui",no:"Non"},
  en:{eyebrow:"Citizen account",title:"My profile",save:"Save",saving:"Saving…",edit:"Edit",updated:"Profile updated.",error:"Unable to update the profile.",account:"Account",citizen:"Citizen account",complete:"Profile complete",identity:"Identity",personal:"Personal information",first:"First name",last:"Last name",profession:"Profession",gender:"Gender",birth:"Date of birth",female:"Female",male:"Male",other:"Other",prefer:"Prefer not to say",contact:"Contact",reach:"How to reach you",email:"Email",phone:"Phone",addressBlock:"Address",addressTitle:"Residence and area",address:"Address",habitat:"Residence / habitat",district:"District",sector:"Sector",street:"Street",building:"Building",apartment:"Apartment",preferences:"Preferences",experience:"Your experience",language:"Language",notifications:"Notifications",enabled:"Enabled",system:"System information",citizenId:"Citizen ID",verified:"Email verified",connection:"Sign-in",status:"Status",active:"Active",yes:"Yes",no:"No"},
  mg:{eyebrow:"Kaontin'ny mponina",title:"Ny mombamomba ahy",save:"Hitahiry",saving:"Mitahiry…",edit:"Hanova",updated:"Voaova ny mombamomba.",error:"Tsy afaka manavao ny mombamomba.",account:"Kaonty",citizen:"Kaontin'ny mponina",complete:"Mombamomba feno",identity:"Mombamomba",personal:"Fampahalalana manokana",first:"Anarana",last:"Fanampin'anarana",profession:"Asa",gender:"Lahy/Vavy",birth:"Daty nahaterahana",female:"Vavy",male:"Lahy",other:"Hafa",prefer:"Tsy te hilaza",contact:"Fifandraisana",reach:"Fomba hifandraisana aminao",email:"Mailaka",phone:"Telefaona",addressBlock:"Adiresy",addressTitle:"Toeram-ponenana sy faritra",address:"Adiresy",habitat:"Toeram-ponenana",district:"Quartier / district",sector:"Secteur",street:"Arabe",building:"Trano",apartment:"Appartement",preferences:"Safidy",experience:"Ny traikefanao",language:"Fiteny",notifications:"Fampahafantarana",enabled:"Mandeha",system:"Fampahalalana rafitra",citizenId:"ID mponina",verified:"Mailaka voamarina",connection:"Fidirana",status:"Sata",active:"Miasa",yes:"Eny",no:"Tsia"}
};

export default function CitizenProfile(){
  const {user,replaceUser,refreshUser}=useAuth();
  const [locale]=useLocale(); const copy=COPY[locale]||COPY.fr;
  const [saving,setSaving]=useState(false);
  const [status,setStatus]=useState(null);
  const [form,setForm]=useState({first_name:"",last_name:"",profession:"",gender:"prefer_not_to_say",birth_date:"",phone_number:"",address:"",habitat:"",district:"",sector:"",street:"",building:"",apartment:"",locale:getLocale()});

  useEffect(()=>{
    setForm({
      first_name:user?.first_name||"",
      last_name:user?.last_name||"",
      profession:user?.profession||"",
      gender:user?.gender||"prefer_not_to_say",
      birth_date:user?.birth_date||"",
      phone_number:user?.phone_number||"",
      address:user?.address||"",
      habitat:user?.habitat||"",
      district:user?.district||"",
      sector:user?.sector||"",
      street:user?.street||"",
      building:user?.building||"",
      apartment:user?.apartment||"",
      locale:getLocale(),
    });
  },[user,locale]);

  const completion=useMemo(()=>{
    const fields=[user?.first_name,user?.last_name,user?.email,user?.phone_number,user?.profession,user?.address,user?.district,getLocale()];
    return Math.round((fields.filter(Boolean).length/fields.length)*100);
  },[user,locale]);

  const initials=((user?.first_name?.[0]||"")+(user?.last_name?.[0]||"")||"NT").toUpperCase();

  async function saveProfile(){
    setSaving(true);setStatus(null);
    try{
      const payload={
        first_name:form.first_name,
        last_name:form.last_name,
        phone_number:form.phone_number,
        ...(["fr","en","mg"].includes(form.locale)?{locale:form.locale}:{}),
      };
      ["profession","gender","birth_date","address","habitat","district","sector","street","building","apartment"].forEach((key)=>{
        payload[key]=form[key] ?? "";
      });

      const response=await updateProfile(payload);
      const candidate=response?.user || response;
      if(candidate && typeof candidate==="object")replaceUser({...user,...candidate});
      try{ await refreshUser(); }catch{}
      setLocale(form.locale);
      setStatus({type:"success",message:copy.updated});
    }catch(error){
      setStatus({type:"error",message:getApiErrorMessage(error,copy.error)});
    }finally{setSaving(false)}
  }

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow={copy.eyebrow} title={copy.title} actions={<button className="topbar-cta" onClick={saveProfile} disabled={saving}>{saving?copy.saving:copy.save}</button>}/>
    <main className="portal-content profile-page">
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
            <label><span>{copy.first}</span><input disabled={saving} value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/></label>
            <label><span>{copy.last}</span><input disabled={saving} value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/></label>
            <label><span>{copy.profession}</span><input disabled={saving} value={form.profession} onChange={e=>setForm({...form,profession:e.target.value})}/></label>
            <label><span>{copy.gender}</span><select disabled={saving} value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option value="female">{copy.female}</option><option value="male">{copy.male}</option><option value="other">{copy.other}</option><option value="prefer_not_to_say">{copy.prefer}</option></select></label>
            <label><span>{copy.birth}</span><input type="date" disabled={saving} value={form.birth_date} onChange={e=>setForm({...form,birth_date:e.target.value})}/></label>
          </div>
        </section>

        <section className="portal-card">
          <div className="portal-card__head"><div><span className="section-label">{copy.contact}</span><h3>{copy.reach}</h3></div></div>
          <div className="profile-form-grid">
            <label><span>{copy.email}</span><input className="profile-readonly-field" readOnly aria-readonly="true" value={user?.email||""}/></label>
            <label><span>{copy.phone}</span><input disabled={saving} value={form.phone_number} onChange={e=>setForm({...form,phone_number:e.target.value})} placeholder="+261..."/></label>
          </div>
        </section>

        <section className="portal-card">
          <div className="portal-card__head"><div><span className="section-label">{copy.addressBlock}</span><h3>{copy.addressTitle}</h3></div></div>
          <div className="profile-form-grid">
            <label className="span-2"><span>{copy.address}</span><input disabled={saving} value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
            <label><span>{copy.habitat}</span><input disabled={saving} value={form.habitat} onChange={e=>setForm({...form,habitat:e.target.value})}/></label>
            <label><span>{copy.district}</span><input disabled={saving} value={form.district} onChange={e=>setForm({...form,district:e.target.value})}/></label>
            <label><span>{copy.sector}</span><input disabled={saving} value={form.sector} onChange={e=>setForm({...form,sector:e.target.value})}/></label>
            <label><span>{copy.street}</span><input disabled={saving} value={form.street} onChange={e=>setForm({...form,street:e.target.value})}/></label>
            <label><span>{copy.building}</span><input disabled={saving} value={form.building} onChange={e=>setForm({...form,building:e.target.value})}/></label>
            <label><span>{copy.apartment}</span><input disabled={saving} value={form.apartment} onChange={e=>setForm({...form,apartment:e.target.value})}/></label>
          </div>
        </section>

        <section className="portal-card">
          <div className="portal-card__head"><div><span className="section-label">{copy.preferences}</span><h3>{copy.experience}</h3></div></div>
          <div className="profile-form-grid">
            <label><span>{copy.language}</span><select disabled={saving} value={form.locale} onChange={e=>setForm({...form,locale:e.target.value})}><option value="fr">Français</option><option value="en">English</option><option value="mg">Malagasy</option></select></label>
            <label><span>{copy.notifications}</span><input className="profile-readonly-field" readOnly aria-readonly="true" value={copy.enabled}/></label>
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

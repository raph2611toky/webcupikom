import LanguageSwitcher from "../../components/ui/LanguageSwitcher.jsx";
import { lazy, Suspense, useEffect, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { useLocale } from "../../utils/i18n.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getCitizenContactMessages, sendContactMessage } from "../../api/contact.js";
import { navigate } from "../../utils/navigation.js";
import { getDataModePreference, getPerformanceSnapshot, setDataModePreference } from "../../utils/performance.js";
import { useDataMode } from "../../utils/useDataMode.js";

const AccountSettingsCard=lazy(()=>import("../../components/ui/AccountSettingsCard.jsx"));

const COPY={
  fr:{eyebrow:"Compte",title:"Paramètres",notifications:"Notifications",choose:"Choisissez ce que vous recevez",app:"Notifications dans l’application",email:"Notifications par e-mail",local:"Ces réglages sont une prévisualisation : ils ne modifient pas encore les notifications reçues.",privacy:"Confidentialité",session:"Votre session",sessionText:"Retrouvez vos informations et gérez la sécurité de votre compte depuis cet espace."},
  en:{eyebrow:"Account",title:"Settings",notifications:"Notifications",choose:"Choose what you receive",app:"In-app notifications",email:"Email notifications",local:"These controls are a preview; they do not change the notifications you receive yet.",privacy:"Privacy",session:"Your session",sessionText:"Manage your information and account security from this space."},
  mg:{eyebrow:"Kaonty",title:"Fikirana",notifications:"Fampahafantarana",choose:"Safidio izay tianao horaisina",app:"Fampahafantarana ao amin'ny rindranasa",email:"Fampahafantarana amin'ny mailaka",local:"Mijanona eto amin'ity fitaovana ity ireo safidy ireo raha mbola tsy misy API manokana.",privacy:"Tsiambaratelo",session:"Ny session-nao",sessionText:"Averina amin'ny cookie HttpOnly avy amin'ny backend ny session azo antoka. Mijanona ao anaty fitadidian'ny navigateur ny access token."}
};

const TABS=[
  ["general","Général"],
  ["performance","Performance"],
  ["data","Mes données"],
  ["security","Sécurité"],
];

export default function CitizenSettings(){
  const {user}=useAuth();
  const [locale]=useLocale(); const copy=COPY[locale]||COPY.fr;
  const dataProfile=useDataMode();
  const [tab,setTab]=useState("general");
  const [dataPreference,setDataPreferenceState]=useState(()=>getDataModePreference());
  const [email,setEmail]=useState(true);
  const [push,setPush]=useState(true);
  const [exportBundle,setExportBundle]=useState(null);
  const [performanceSnapshot,setPerformanceSnapshot]=useState(null);
  const [exporting,setExporting]=useState(false);
  const [exportError,setExportError]=useState("");
  const [privacyConcern,setPrivacyConcern]=useState({category:"Comprendre l’utilisation de mes données",message:""});
  const [privacySending,setPrivacySending]=useState(false);
  const [privacyReceipt,setPrivacyReceipt]=useState(null);
  const [privacyHistory,setPrivacyHistory]=useState([]);
  const [privacyError,setPrivacyError]=useState("");
  useEffect(()=>setDataPreferenceState(dataProfile.preference),[dataProfile.preference]);

  useEffect(()=>{
    if(tab!=="data")return;
    let active=true;
    getCitizenContactMessages().then(rows=>{
      if(!active)return;
      setPrivacyHistory(rows.filter(item=>String(item.subject||"").startsWith("[Données personnelles]")));
    }).catch(()=>{});
    return()=>{active=false};
  },[tab]);

  async function prepareExport(){
    setExporting(true);setExportError("");
    try{
      const {prepareCitizenDataExport}=await import("../../api/dataExport.js");
      const bundle=await prepareCitizenDataExport({notifications:{in_app:push,email}});
      setExportBundle(bundle);
    }catch(error){setExportError(error?.response?.data?.detail||error?.message||"Impossible de préparer l’export.")}finally{setExporting(false)}
  }
  async function printPersonal(){try{const u=await import("../../utils/dataExport.js");u.openPrintWindow(u.buildPersonalDataHtml(exportBundle))}catch(error){setExportError(error?.message||"Impression impossible.")}}
  async function downloadPersonalHtml(){const u=await import("../../utils/dataExport.js");u.downloadHtml("nova-terra-mes-donnees.html",u.buildPersonalDataHtml(exportBundle))}
  async function downloadPersonalJson(){const u=await import("../../utils/dataExport.js");u.downloadJson("nova-terra-mes-donnees.json",exportBundle)}
  function changeDataPreference(next){setDataPreferenceState(next);setDataModePreference(next)}

  async function submitPrivacyConcern(event){
    event.preventDefault();
    if(!privacyConcern.message.trim())return;
    setPrivacySending(true);setPrivacyError("");setPrivacyReceipt(null);
    const subject=`[Données personnelles] ${privacyConcern.category}`;
    try{
      const result=await sendContactMessage({
        name:user?.display_name||`${user?.first_name||""} ${user?.last_name||""}`.trim()||"Citoyen",
        email:user?.email||"",
        subject,
        message:`Préoccupation concernant l’utilisation de mes données sur Nova Terra.\n\nCatégorie : ${privacyConcern.category}\n\n${privacyConcern.message.trim()}`,
      });
      let reference=result?.reference||result?.contact?.reference||result?.message?.reference||"";
      try{
        const rows=await getCitizenContactMessages();
        const concerns=rows.filter(item=>String(item.subject||"").startsWith("[Données personnelles]"));
        setPrivacyHistory(concerns);
        if(!reference){
          const match=concerns.find(item=>item.subject===subject);
          reference=match?.reference||"";
        }
      }catch{}
      setPrivacyReceipt({reference,createdAt:new Date().toISOString()});
      setPrivacyConcern(current=>({...current,message:""}));
    }catch(error){
      setPrivacyError(error?.response?.data?.detail||error?.message||"Impossible d’envoyer votre préoccupation.");
    }finally{setPrivacySending(false)}
  }

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow={copy.eyebrow} title={copy.title}/>
    <main className="portal-content settings-page settings-page--tabs">
      <nav className="settings-tabs" aria-label="Rubriques des paramètres">
        {TABS.map(([value,label])=><button key={value} type="button" className={tab===value?"is-active":""} aria-pressed={tab===value} onClick={()=>setTab(value)}>{label}</button>)}
      </nav>

      {tab==="general"?<section className="settings-tab-panel settings-general-grid">
        <article className="portal-card settings-account-summary">
          <div className="portal-card__head"><div><span className="section-label">{locale === "en" ? "Account" : "Compte"}</span><h3>{locale === "en" ? "Your information" : "Vos informations"}</h3></div><button type="button" className="secondary-action" onClick={()=>navigate("/citizen/profile")}>{locale === "en" ? "Edit profile" : "Modifier mon profil"}</button></div>
          <dl className="settings-account-fields">
            <div><dt>{locale === "en" ? "Name" : "Nom"}</dt><dd>{user?.display_name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "—"}</dd></div>
            <div><dt>Email</dt><dd>{user?.email || "—"}</dd></div>
            <div><dt>{locale === "en" ? "Interface language" : "Langue de l’interface"}</dt><dd><LanguageSwitcher/></dd></div>
          </dl>
        </article>
        <article className="portal-card">
          <span className="section-label">{copy.notifications}</span><h3>{copy.choose}</h3>
          <Toggle label={copy.app} value={push} setValue={setPush}/>
          <Toggle label={copy.email} value={email} setValue={setEmail}/>
          <p className="detail-copy">{copy.local}</p>
        </article>
        <article className="portal-card">
          <span className="section-label">{copy.privacy}</span><h3>{copy.session}</h3>
          <p className="detail-copy">{copy.sessionText}</p>
        </article>
      </section>:null}

      {tab==="performance"?<section className="portal-card performance-settings-card settings-tab-panel">
        <span className="section-label">Préférences de chargement</span><h3>Mode léger et appareils peu puissants</h3>
        <p className="detail-copy">Nova Terra adapte le chargement aux connexions lentes, à l’économie de données et aux appareils peu puissants lorsque le navigateur fournit ces informations.</p>
        <div className="data-mode-buttons" role="group" aria-label="Mode de chargement">
          <button type="button" aria-pressed={dataPreference==="auto"} className={dataPreference==="auto"?"is-active":""} onClick={()=>changeDataPreference("auto")}><strong>Automatique</strong><span>S’adapte à la connexion</span></button>
          <button type="button" aria-pressed={dataPreference==="reduced"} className={dataPreference==="reduced"?"is-active":""} onClick={()=>changeDataPreference("reduced")}><strong>Mode léger</strong><span>Moins d’animations et de médias</span></button>
          <button type="button" aria-pressed={dataPreference==="full"} className={dataPreference==="full"?"is-active":""} onClick={()=>changeDataPreference("full")}><strong>Complet</strong><span>Affichage riche autorisé</span></button>
        </div>
        <div className="data-mode-status" role="status"><span>Mode actif</span><strong>{dataProfile.reduced?"Léger / simplifié":"Complet"}</strong><small>Connexion : {dataProfile.effectiveType||"inconnue"} · Appareil : {dataProfile.deviceTier==="low"?"peu puissant":dataProfile.deviceTier==="standard"?"standard":"non détecté"}{dataProfile.deviceMemory?` · ${dataProfile.deviceMemory} Go RAM estimés`:""}{dataProfile.hardwareConcurrency?` · ${dataProfile.hardwareConcurrency} threads`:""}</small></div>
        <div className="performance-audit-box performance-audit-box--compact">
          <div><strong>Diagnostic de cette page</strong><span>Informations de chargement de cette page.</span></div>
          <button type="button" className="secondary-action" onClick={()=>setPerformanceSnapshot(getPerformanceSnapshot())}>Mesurer</button>
          {performanceSnapshot?<div className="performance-audit-metrics" role="status">
            <div><strong>{performanceSnapshot.resourceCount}</strong><span>ressources</span></div>
            <div><strong>{performanceSnapshot.transferKb} Ko</strong><span>transférés</span></div>
            <div><strong>{performanceSnapshot.imageCount}</strong><span>images</span></div>
            <div><strong>{performanceSnapshot.scriptCount}</strong><span>scripts</span></div>
          </div>:null}
        </div>
      </section>:null}

      {tab==="data"?<div className="settings-tab-panel settings-data-grid">
        <section className="portal-card data-export-card">
          <span className="section-label">Mes données</span><h3>Récupérer mes informations</h3>
          <p className="detail-copy">Préparez une copie de votre profil, demandes, signalements, rendez-vous, notifications, messages et préférences.</p>
          {exportError?<div className="error-card" role="alert">{exportError}</div>:null}
          {!exportBundle?<button type="button" className="primary-action" disabled={exporting} onClick={prepareExport}>{exporting?"Préparation…":"Préparer mon export"}</button>:<>
            <div className="data-export-summary" role="status">
              <div><strong>{exportBundle.summary?.requests||0}</strong><span>Démarches</span></div>
              <div><strong>{exportBundle.summary?.reports||0}</strong><span>Signalements</span></div>
              <div><strong>{exportBundle.summary?.appointments||0}</strong><span>Rendez-vous</span></div>
              <div><strong>{exportBundle.summary?.notifications||0}</strong><span>Notifications</span></div>
            </div>
            {exportBundle.warnings?.length?<p className="data-export-warning">Rubriques non chargées : {exportBundle.warnings.join(" · ")}</p>:null}
            <div className="data-export-actions">
              <button type="button" className="primary-action" onClick={printPersonal}>Imprimer / PDF</button>
              <button type="button" className="secondary-action" onClick={downloadPersonalHtml}>HTML</button>
              <button type="button" className="secondary-action" onClick={downloadPersonalJson}>JSON</button>
              <button type="button" className="text-action" onClick={prepareExport} disabled={exporting}>Actualiser</button>
            </div>
          </>}
        </section>

        <section className="portal-card privacy-concern-card">
          <div className="privacy-concern-head"><div><span className="section-label">Utilisation de mes données</span><h3>Comprendre et signaler une inquiétude</h3></div><button type="button" className="text-action" onClick={()=>navigate("/citizen/messages")}>Mes messages →</button></div>
          <p className="detail-copy">Nova Terra utilise les informations nécessaires pour vous identifier, traiter vos démarches et signalements, organiser vos rendez-vous et vous informer de leur évolution.</p>
          <div className="privacy-use-grid">
            <div><strong>Profil</strong><span>Identité, contact et préférences utiles à votre espace.</span></div>
            <div><strong>Démarches</strong><span>Informations nécessaires au traitement et au suivi de vos demandes.</span></div>
            <div><strong>Rendez-vous</strong><span>Créneau, préparation et rappels liés à vos rendez-vous.</span></div>
            <div><strong>Notifications</strong><span>Messages destinés à vous informer des changements importants.</span></div>
          </div>
          {privacyReceipt?<div className="privacy-receipt" role="status"><strong>✓ Préoccupation enregistrée</strong><span>{privacyReceipt.reference?<>Référence : <b>{privacyReceipt.reference}</b></>:"Votre message a été transmis. Retrouvez sa trace dans Mes messages."}</span></div>:null}
          {privacyError?<div className="error-card" role="alert">{privacyError}</div>:null}
          <form className="privacy-concern-form" onSubmit={submitPrivacyConcern}>
            <label><span>Votre inquiétude concerne</span><select value={privacyConcern.category} onChange={e=>setPrivacyConcern(v=>({...v,category:e.target.value}))}>
              <option>Comprendre l’utilisation de mes données</option>
              <option>Une donnée incorrecte</option>
              <option>Accès ou confidentialité</option>
              <option>Conservation ou suppression</option>
              <option>Autre préoccupation</option>
            </select></label>
            <label><span>Expliquez votre préoccupation</span><textarea rows="4" required value={privacyConcern.message} onChange={e=>setPrivacyConcern(v=>({...v,message:e.target.value}))} placeholder="Décrivez simplement ce que vous souhaitez comprendre ou signaler…"/></label>
            <button type="submit" className="secondary-action" disabled={privacySending||!privacyConcern.message.trim()}>{privacySending?"Envoi…":"Envoyer ma préoccupation"}</button>
          </form>
          {privacyHistory.length?<div className="privacy-history"><strong>Mes dernières remontées</strong>{privacyHistory.slice(0,3).map(item=><button type="button" key={item.reference} onClick={()=>navigate(`/citizen/messages/${encodeURIComponent(item.reference)}`)}><span><b>{item.reference}</b><small>{String(item.subject||"").replace("[Données personnelles] ","")}</small></span><em>{item.statusLabel||item.status}</em></button>)}</div>:null}
        </section>
      </div>:null}

      {tab==="security"?<section className="settings-tab-panel settings-security-panel">
        <Suspense fallback={<div className="settings-deferred-card settings-deferred-card--compact" role="status">Chargement des réglages de sécurité…</div>}><AccountSettingsCard allowDelete/></Suspense>
      </section>:null}
    </main>
  </div></div>;
}

function Toggle({label,value,setValue}){
  return <button className="toggle-line" type="button" aria-pressed={value} onClick={()=>setValue(!value)}><span>{label}</span><i className={value?"is-on":""}><b/></i></button>;
}

import { useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import AccountSettingsCard from "../../components/ui/AccountSettingsCard.jsx";
import { useLocale } from "../../utils/i18n.js";
import { prepareCitizenDataExport } from "../../api/dataExport.js";
import { buildPersonalDataHtml, buildRequestsHtml, downloadHtml, downloadJson, downloadRequestsCsv, openPrintWindow } from "../../utils/dataExport.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const COPY={
  fr:{eyebrow:"Compte",title:"Paramètres",notifications:"Notifications",choose:"Choisissez ce que vous recevez",app:"Notifications dans l’application",email:"Notifications par e-mail",local:"Ces préférences visuelles restent locales tant que l’API ne fournit pas de réglage de notification dédié.",privacy:"Confidentialité",session:"Votre session",sessionText:"La session sécurisée est restaurée grâce au cookie HttpOnly du backend. Le token d’accès reste en mémoire du navigateur."},
  en:{eyebrow:"Account",title:"Settings",notifications:"Notifications",choose:"Choose what you receive",app:"In-app notifications",email:"Email notifications",local:"These visual preferences stay local until the API provides dedicated notification settings.",privacy:"Privacy",session:"Your session",sessionText:"The secure session is restored through the backend HttpOnly cookie. The access token stays in browser memory."},
  mg:{eyebrow:"Kaonty",title:"Fikirana",notifications:"Fampahafantarana",choose:"Safidio izay tianao horaisina",app:"Fampahafantarana ao amin'ny rindranasa",email:"Fampahafantarana amin'ny mailaka",local:"Mijanona eto amin'ity fitaovana ity ireo safidy ireo raha mbola tsy misy API manokana.",privacy:"Tsiambaratelo",session:"Ny session-nao",sessionText:"Averina amin'ny cookie HttpOnly avy amin'ny backend ny session azo antoka. Mijanona ao anaty fitadidian'ny navigateur ny access token."}
};

export default function CitizenSettings(){
  const [locale]=useLocale(); const copy=COPY[locale]||COPY.fr;
  const [email,setEmail]=useState(true);
  const [push,setPush]=useState(true);
  const [exportBundle,setExportBundle]=useState(null);
  const [exporting,setExporting]=useState(false);
  const [exportError,setExportError]=useState("");

  async function prepareExport(){
    setExporting(true);setExportError("");
    try{
      const bundle=await prepareCitizenDataExport({notifications:{in_app:push,email}});
      setExportBundle(bundle);
    }catch(error){setExportError(error?.response?.data?.detail||error?.message||"Impossible de préparer l’export.")}finally{setExporting(false)}
  }
  function allRequests(){return exportBundle?[...(exportBundle.requests||[]),...(exportBundle.reports||[])]:[]}
  function runPrint(html){try{openPrintWindow(html)}catch(error){setExportError(error?.message||"Impression impossible.")}}

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow={copy.eyebrow} title={copy.title}/>
    <main className="portal-content settings-page">
      <div className="settings-grid">
        <section className="portal-card">
          <span className="section-label">{copy.notifications}</span><h3>{copy.choose}</h3>
          <Toggle label={copy.app} value={push} setValue={setPush}/>
          <Toggle label={copy.email} value={email} setValue={setEmail}/>
          <p className="detail-copy">{copy.local}</p>
        </section>


        <section className="portal-card data-export-card">
          <span className="section-label">Mes données</span><h3>Récupérer mes informations</h3>
          <p className="detail-copy">Préparez une copie claire de votre profil, vos demandes, signalements, rendez-vous, notifications, messages et préférences. Les fichiers sont générés dans votre navigateur à partir des données de votre compte.</p>
          {exportError?<div className="error-card" role="alert">{exportError}</div>:null}
          {!exportBundle?<button type="button" className="primary-action" disabled={exporting} onClick={prepareExport}>{exporting?"Préparation…":"Préparer mon export"}</button>:<>
            <div className="data-export-summary" role="status">
              <div><strong>{exportBundle.summary?.requests||0}</strong><span>Démarches</span></div>
              <div><strong>{exportBundle.summary?.reports||0}</strong><span>Signalements</span></div>
              <div><strong>{exportBundle.summary?.appointments||0}</strong><span>Rendez-vous</span></div>
              <div><strong>{exportBundle.summary?.notifications||0}</strong><span>Notifications</span></div>
            </div>
            {exportBundle.warnings?.length?<p className="data-export-warning">Certaines rubriques n’ont pas pu être chargées : {exportBundle.warnings.join(" · ")}</p>:null}
            <div className="data-export-actions">
              <button type="button" className="primary-action" onClick={()=>runPrint(buildPersonalDataHtml(exportBundle))}>Imprimer / PDF</button>
              <button type="button" className="secondary-action" onClick={()=>downloadHtml("nova-terra-mes-donnees.html",buildPersonalDataHtml(exportBundle))}>HTML</button>
              <button type="button" className="secondary-action" onClick={()=>downloadJson("nova-terra-mes-donnees.json",exportBundle)}>JSON</button>
              <button type="button" className="secondary-action" onClick={()=>downloadRequestsCsv(allRequests())}>CSV demandes</button>
              <button type="button" className="secondary-action" onClick={()=>runPrint(buildRequestsHtml(allRequests()))}>Récapitulatif demandes</button>
              <button type="button" className="text-action" onClick={prepareExport} disabled={exporting}>Actualiser les données</button>
            </div>
            <p className="detail-copy">Le CSV et le récapitulatif regroupent les démarches et les signalements avec leur référence, statut, service et dates.</p>
          </>}
        </section>

        <AccountSettingsCard allowDelete/>

        <section className="portal-card">
          <span className="section-label">{copy.privacy}</span><h3>{copy.session}</h3>
          <p className="detail-copy">{copy.sessionText}</p>
        </section>
      </div>
    </main>
  </div></div>;
}

function Toggle({label,value,setValue}){
  return <button className="toggle-line" type="button" aria-pressed={value} onClick={()=>setValue(!value)}><span>{label}</span><i className={value?"is-on":""}><b/></i></button>;
}

import { useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import AccountSettingsCard from "../../components/ui/AccountSettingsCard.jsx";
import { useLocale } from "../../utils/i18n.js";
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

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow={copy.eyebrow} title={copy.title}/>
    <main className="portal-content">
      <div className="settings-grid">
        <section className="portal-card">
          <span className="section-label">{copy.notifications}</span><h3>{copy.choose}</h3>
          <Toggle label={copy.app} value={push} setValue={setPush}/>
          <Toggle label={copy.email} value={email} setValue={setEmail}/>
          <p className="detail-copy">{copy.local}</p>
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

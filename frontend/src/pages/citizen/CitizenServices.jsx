import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getServices } from "../../api/services.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const COPY={
  fr:{
    eyebrow:"Ville",
    title:"Services municipaux",
    introTitle:"Tous vos services municipaux",
    intro:"Retrouvez rapidement les services de Nova Terra et accédez aux informations utiles avant de commencer une démarche.",
    open:"Ouvrir le service",
  },
  en:{
    eyebrow:"City",
    title:"City services",
    introTitle:"All city services",
    intro:"Quickly find Nova Terra services and the useful information you need before starting a procedure.",
    open:"Open service",
  },
  mg:{
    eyebrow:"Tanàna",
    title:"Sampan-draharahan'ny tanàna",
    introTitle:"Ireo sampan-draharaha rehetra",
    intro:"Tadiavo haingana ireo sampan-draharaha ao Nova Terra sy ny vaovao ilaina alohan'ny hanombohana dingana iray.",
    open:"Hijery ny sampan-draharaha",
  },
};

const TONES=["blue","orange","green","pink","purple","cyan","teal","violet"];

function serviceTone(service,index){
  const text=`${service?.slug||""} ${service?.name||""} ${service?.category||""}`.toLowerCase();
  if(/admin|etat|état|civil/.test(text))return "blue";
  if(/energie|énergie|electric|électric/.test(text))return "orange";
  if(/habitat|logement|résidence|residence/.test(text))return "green";
  if(/santé|sante|health/.test(text))return "pink";
  if(/sécurité|securite|security/.test(text))return "purple";
  if(/transport|mobilit/.test(text))return "cyan";
  if(/eau|voirie|déchet|dechet|infrastructure/.test(text))return "teal";
  return TONES[index%TONES.length];
}

export default function CitizenServices(){
  const [locale]=useLocale();
  const copy=COPY[locale]||COPY.fr;
  const [services,setServices]=useState([]);

  useEffect(()=>{getServices().then(setServices).catch(()=>setServices([]))},[locale]);

  const prepared=useMemo(()=>services.map((service,index)=>({
    ...service,
    tone:serviceTone(service,index),
  })),[services]);

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow={copy.eyebrow} title={copy.title}/>
      <main className="portal-content citizen-services-page">
        <section className="citizen-services-intro">
          <div>
            <span className="section-label">Services</span>
            <h2>{copy.introTitle}</h2>
            <p>{copy.intro}</p>
          </div>
        </section>

        <section className="citizen-service-grid citizen-service-grid--v39">
          {prepared.map(service=><article
            key={service.slug}
            className={`citizen-service-card service-tone-${service.tone}`}
          >
            <div className="citizen-service-card__decor" aria-hidden="true"/>
            <div className="citizen-service-card__icon" aria-hidden="true">{service.icon}</div>
            <span className="citizen-service-card__category">{service.category}</span>
            <h2>{service.name}</h2>
            <p>{service.shortDescription}</p>
            <span className="citizen-service-card__watermark" aria-hidden="true">{service.icon}</span>
            <button
              className="citizen-service-card__cta"
              type="button"
              onClick={()=>navigate(`/citizen/services/${service.slug}`)}
            >
              <span>{copy.open}</span>
              <i aria-hidden="true">→</i>
            </button>
          </article>)}
        </section>
      </main>
    </div>
  </div>;
}

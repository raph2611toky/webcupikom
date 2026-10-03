import { useEffect, useMemo, useState } from "react";
import { navigate } from "../../utils/navigation.js";
import { useLocale } from "../../utils/i18n.js";
import "../../styles/app-shell.css";

const GUIDES = {
  dashboard: {
    match:(path)=>path==="/citizen"||path==="/citizen/dashboard",
    action:"/citizen/services",
    fr:{title:"Pour bien commencer",text:"Vérifiez votre profil, découvrez un service puis lancez votre première démarche. Trois repères suffisent pour démarrer.",action:"Découvrir les services"},
    en:{title:"A quick start",text:"Check your profile, discover a service, then start your first request. Three simple steps are enough to begin.",action:"Discover services"},
    mg:{title:"Hanombohana tsara",text:"Jereo ny mombamomba anao, tadiavo ny sampan-draharaha iray ary atombohy ny fangatahana voalohany.",action:"Hijery sampan-draharaha"},
  },
  reports: {
    match:(path)=>path==="/citizen/signalements",
    action:null,
    fr:{title:"Un bon signalement = un lieu précis",text:"Choisissez le type de problème, ajoutez le lieu puis une description et, si possible, une photo.",action:""},
    en:{title:"A good report needs a precise location",text:"Choose the problem type, add the location, then a description and a photo if possible.",action:""},
    mg:{title:"Mila toerana mazava ny tatitra",text:"Safidio ny karazana olana, ampio ny toerana, ny fanazavana ary sary raha misy.",action:""},
  },
  requests: {
    match:(path)=>path==="/citizen/requests",
    action:null,
    fr:{title:"Votre première demande",text:"Cliquez sur « Nouvelle demande », choisissez votre besoin, décrivez-le puis envoyez. Une référence confirme immédiatement l’envoi.",action:""},
    en:{title:"Your first request",text:"Choose “New request”, select your need, describe it and send it. A reference immediately confirms submission.",action:""},
    mg:{title:"Ny fangatahana voalohany",text:"Tsindrio « Fangatahana vaovao », safidio ny filànao, hazavao ary alefaso. Hiseho avy hatrany ny laharana.",action:""},
  },
  services: {
    match:(path)=>path==="/citizen/services",
    action:null,
    fr:{title:"Trouver le bon service",text:"Utilisez la liste ou la carte pour comparer horaires, coordonnées, démarches et documents requis.",action:""},
    en:{title:"Find the right service",text:"Use the list or map to compare opening hours, contacts, procedures and required documents.",action:""},
    mg:{title:"Tadiavo ny sampan-draharaha mety",text:"Ampiasao ny lisitra na sarintany hijerena ora, fifandraisana, dingana ary taratasy ilaina.",action:""},
  },
  appointments: {
    match:(path)=>path==="/citizen/appointments",
    action:null,
    fr:{title:"Choisissez un créneau sans ambiguïté",text:"Sélectionnez le service et la date, puis vérifiez le récapitulatif avant de confirmer votre rendez-vous.",action:""},
    en:{title:"Choose an unambiguous time slot",text:"Select the service and date, then check the summary before confirming your appointment.",action:""},
    mg:{title:"Safidio mazava ny fotoana",text:"Safidio ny sampan-draharaha sy daty, avy eo jereo ny famintinana alohan'ny hanamafisana.",action:""},
  },
  projects: {
    match:(path)=>path==="/citizen/projects"||path.startsWith("/citizen/projects/"),
    action:"/citizen/projects",
    fr:{title:"Participer à Nova Terra",text:"Consultez l’avancement d’un projet. Lorsqu’une consultation ou décision est ouverte, votre contribution reçoit une référence et reste consultable.",action:"Voir les projets"},
    en:{title:"Take part in Nova Terra",text:"Review a project’s progress. When a consultation or decision is open, your contribution gets a reference and remains visible.",action:"View projects"},
    mg:{title:"Mandraisa anjara ao Nova Terra",text:"Jereo ny fandrosoan'ny tetikasa. Raha misokatra ny fandraisana hevitra dia hahazo laharana ny fandraisanao anjara.",action:"Hijery tetikasa"},
  },
  help: {
    match:(path)=>path==="/citizen/help",
    action:"/citizen/requests",
    fr:{title:"Question ou démarche ?",text:"Utilisez Nous contacter pour une question générale. Pour une demande que vous voulez suivre, utilisez Mes demandes.",action:"Mes demandes"},
    en:{title:"Question or procedure?",text:"Use Contact us for a general question. For something you want to track, use My requests.",action:"My requests"},
    mg:{title:"Fanontaniana sa fangatahana?",text:"Ampiasao Hifandray aminay ho an'ny fanontaniana ankapobeny. Raha zavatra arahina dia ampiasao Ny fangatahako.",action:"Ny fangatahako"},
  },
};

const GENERIC_GUIDE = {
  action:null,
  fr:{title:"Besoin d’un repère ?",text:"Utilisez le menu pour revenir au tableau de bord, retrouver vos demandes, services, projets et rendez-vous.",action:""},
  en:{title:"Need a quick pointer?",text:"Use the menu to return to the dashboard or find your requests, services, projects and appointments.",action:""},
  mg:{title:"Mila toromarika ?",text:"Ampiasao ny sakafo hiverenana amin'ny tabilao na hahitana fangatahana, serivisy, tetikasa ary fotoana.",action:""},
};

function getGuide(path) {
  return Object.entries(GUIDES).find(([,guide])=>guide.match(path)) || ["general",GENERIC_GUIDE];
}

export default function CitizenGuide() {
  const [locale]=useLocale();
  const [visible,setVisible]=useState(false);
  const path=window.location.pathname;
  const matched=useMemo(()=>getGuide(path),[path]);

  useEffect(()=>{
    const [key]=matched;
    setVisible(localStorage.getItem(`nova_terra_context_help_${key}`)!=="done");
  },[matched]);

  const [key,guide]=matched;
  const copy=guide[locale]||guide.fr;

  function close(){
    localStorage.setItem(`nova_terra_context_help_${key}`,"done");
    setVisible(false);
  }

  function reopen(){
    setVisible(true);
  }

  function act(){
    close();
    if(guide.action) navigate(guide.action);
  }

  if(!visible){
    return <button className="citizen-context-guide-trigger" type="button" onClick={reopen} aria-label={locale==="en"?"Open contextual tips":locale==="mg"?"Sokafy ny toromarika":"Ouvrir les indications contextuelles"}>
      <span aria-hidden="true">?</span><b>{locale==="en"?"Tips":locale==="mg"?"Toromarika":"Indications"}</b>
    </button>;
  }

  return <aside className="citizen-context-guide" role="status" aria-live="polite">
    <div className="citizen-context-guide__icon" aria-hidden="true">?</div>
    <div className="citizen-context-guide__body">
      <strong>{copy.title}</strong>
      <p>{copy.text}</p>
      <div className="citizen-context-guide__actions">
        {guide.action ? <button className="primary-action" type="button" onClick={act}>{copy.action}</button> : null}
        <button className="guide-dismiss" type="button" onClick={close}>{locale==="en"?"Got it":locale==="mg"?"Azoko":"Compris"}</button>
      </div>
    </div>
    <button className="citizen-context-guide__close" type="button" onClick={close} aria-label={locale==="en"?"Close":locale==="mg"?"Hidio":"Fermer"}>×</button>
  </aside>;
}

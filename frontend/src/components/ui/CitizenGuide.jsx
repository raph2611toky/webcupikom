import { useEffect, useMemo, useState } from "react";
import { navigate } from "../../utils/navigation.js";
import { useLocale } from "../../utils/i18n.js";
import "../../styles/app-shell.css";

const GUIDES = {
  dashboard: {
    match:(path)=>path==="/citizen"||path==="/citizen/dashboard",
    action:"/citizen/services",
    fr:{title:"Pour bien commencer",text:"Commencez par vérifier votre profil, puis ouvrez un service ou créez votre première demande.",action:"Découvrir les services"},
    en:{title:"A quick start",text:"Check your profile first, then open a service or create your first request.",action:"Discover services"},
    mg:{title:"Hanombohana tsara",text:"Jereo aloha ny mombamomba anao, avy eo sokafy ny sampan-draharaha iray na mamoròna fangatahana voalohany.",action:"Hijery sampan-draharaha"},
  },
  reports: {
    match:(path)=>path==="/citizen/signalements",
    action:null,
    fr:{title:"Un bon signalement = un lieu précis",text:"Choisissez d’abord le type de problème. Ajoutez ensuite la rue, le quartier ou votre position GPS, puis une description et si possible une photo.",action:""},
    en:{title:"A good report needs a precise location",text:"Choose the problem type first. Then add the street, district or GPS position, followed by a description and a photo if possible.",action:""},
    mg:{title:"Mila toerana mazava ny tatitra",text:"Safidio aloha ny karazana olana. Ampio ny arabe, faritra na GPS, avy eo ny fanazavana ary sary raha misy.",action:""},
  },
  requests: {
    match:(path)=>path==="/citizen/requests",
    action:null,
    fr:{title:"Votre premier envoi",text:"Cliquez sur « Nouvelle demande », choisissez le besoin, écrivez votre message puis envoyez. Une référence apparaît immédiatement.",action:""},
    en:{title:"Your first request",text:"Select “New request”, choose what you need, write your message and send it. A reference appears immediately.",action:""},
    mg:{title:"Ny fangatahana voalohany",text:"Tsindrio « Fangatahana vaovao », safidio ny filànao, soraty ny hafatra ary alefaso. Hiseho avy hatrany ny laharana.",action:""},
  },
  services: {
    match:(path)=>path==="/citizen/services",
    action:null,
    fr:{title:"Trouver le bon service",text:"Ouvrez une carte pour voir les horaires, coordonnées, démarches et documents requis.",action:""},
    en:{title:"Find the right service",text:"Open a card to see opening hours, contact details, procedures and required documents.",action:""},
    mg:{title:"Tadiavo ny sampan-draharaha mety",text:"Sokafy ny karatra mba hahitana ny ora, fifandraisana, dingana ary taratasy ilaina.",action:""},
  },
  appointments: {
    match:(path)=>path==="/citizen/appointments",
    action:null,
    fr:{title:"Choisissez un créneau sans ambiguïté",text:"Sélectionnez d’abord le service et la date. Les créneaux réservés ou indisponibles sont désactivés. Vérifiez le récapitulatif avant de confirmer.",action:""},
    en:{title:"Choose an unambiguous time slot",text:"Select the service and date first. Booked or unavailable slots are disabled. Check the summary before confirming.",action:""},
    mg:{title:"Safidio mazava ny fotoana",text:"Safidio aloha ny sampan-draharaha sy daty. Tsy azo tsindriana ny ora efa voatokana na tsy misy. Jereo ny famintinana alohan'ny hanamafisana.",action:""},
  },
  help: {
    match:(path)=>path==="/citizen/help",
    action:"/citizen/requests",
    fr:{title:"Question ou démarche ?",text:"Utilisez Nous contacter pour une question générale. Pour une demande que vous voulez suivre, utilisez Mes demandes.",action:"Mes demandes"},
    en:{title:"Question or procedure?",text:"Use Contact us for a general question. For something you want to track, use My requests.",action:"My requests"},
    mg:{title:"Fanontaniana sa fangatahana?",text:"Ampiasao Hifandray aminay ho an'ny fanontaniana ankapobeny. Raha zavatra arahina dia ampiasao Ny fangatahako.",action:"Ny fangatahako"},
  },
};

function getGuide(path) {
  return Object.entries(GUIDES).find(([,guide])=>guide.match(path)) || null;
}

export default function CitizenGuide() {
  const [locale]=useLocale();
  const [visible,setVisible]=useState(false);
  const path=window.location.pathname;
  const matched=useMemo(()=>getGuide(path),[path]);

  useEffect(()=>{
    if(!matched){setVisible(false);return}
    const [key]=matched;
    setVisible(localStorage.getItem(`nova_terra_context_help_${key}`)!=="done");
  },[matched]);

  if(!matched||!visible) return null;

  const [key,guide]=matched;
  const copy=guide[locale]||guide.fr;

  function close(){
    localStorage.setItem(`nova_terra_context_help_${key}`,"done");
    setVisible(false);
  }

  function act(){
    close();
    if(guide.action) navigate(guide.action);
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
    <button className="citizen-context-guide__close" type="button" onClick={close} aria-label="Fermer">×</button>
  </aside>;
}

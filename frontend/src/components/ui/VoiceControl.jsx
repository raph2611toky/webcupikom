import { useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "../../utils/navigation.js";
import { useLocale } from "../../utils/i18n.js";
import "../../styles/app-shell.css";

const COPY = {
  fr:{button:"Mode vocal",title:"Interaction vocale",listen:"Écouter",stop:"Arrêter",read:"Lire l’aide",close:"Fermer",unsupported:"La reconnaissance vocale n’est pas disponible dans ce navigateur.",hint:"Dites par exemple « mes demandes », « services », « actualités », « nous contacter » ou « profil ».",listening:"Je vous écoute…",heard:"J’ai entendu",unknown:"Commande non reconnue."},
  en:{button:"Voice mode",title:"Voice interaction",listen:"Listen",stop:"Stop",read:"Read help",close:"Close",unsupported:"Voice recognition is not available in this browser.",hint:"Try saying “my requests”, “services”, “news”, “contact us” or “profile”.",listening:"Listening…",heard:"I heard",unknown:"Command not recognized."},
  mg:{button:"Fomba feo",title:"Fifandraisana amin'ny feo",listen:"Hihaino",stop:"Ajanony",read:"Vakio ny fanampiana",close:"Hakatona",unsupported:"Tsy misy fanekena feo amin'ity navigateur ity.",hint:"Azonao lazaina hoe « fangatahako », « sampan-draharaha », « vaovao », « hifandray aminay » na « profil ».",listening:"Mihaino aho…",heard:"Henoko",unknown:"Tsy fantatra ilay baiko."},
};

const PAGE_HELP = {
  "/citizen": {
    fr:"Vous êtes sur votre tableau de bord. Vous pouvez suivre vos demandes, ouvrir un service prioritaire ou créer une nouvelle demande.",
    en:"You are on your dashboard. You can track requests, open a priority service or create a new request.",
    mg:"Ao amin'ny tabilao ianao. Afaka manara-maso fangatahana, manokatra sampan-draharaha na mamorona fangatahana vaovao."
  },
  "/citizen/requests": {
    fr:"Ici, vous retrouvez toutes vos demandes. Utilisez Nouvelle demande pour écrire puis envoyer votre besoin.",
    en:"Here you can find all your requests. Use New request to write and send what you need.",
    mg:"Eto no ahitanao ny fangatahanao rehetra. Ampiasao ny Fangatahana vaovao mba hanoratra sy handefa ny filànao."
  },
  "/citizen/services": {
    fr:"Ouvrez un service pour voir ses horaires, ses coordonnées, les démarches disponibles et les documents requis.",
    en:"Open a service to see its hours, contact details, available procedures and required documents.",
    mg:"Sokafy ny sampan-draharaha iray mba hahitana ny ora fiasana, fifandraisana, dingana azo atao ary taratasy ilaina."
  },
  "/citizen/news": {
    fr:"Cette page rassemble les annonces municipales, changements de service et informations pratiques.",
    en:"This page contains city announcements, service changes and practical information.",
    mg:"Eto no ahitana ny filazana avy amin'ny tanàna, fiovan'ny sampan-draharaha ary vaovao mahasoa."
  },
  "/citizen/profile": {
    fr:"Complétez ici vos informations personnelles et votre langue préférée.",
    en:"Complete your personal information and preferred language here.",
    mg:"Fenoy eto ny mombamomba anao sy ny fiteny tianao ampiasaina."
  },
  "/citizen/help": {
    fr:"Utilisez cette page pour poser une question générale à la ville. Pour une démarche à suivre, utilisez Mes demandes.",
    en:"Use this page for a general question to the city. For a tracked procedure, use My requests.",
    mg:"Ampiasao ity pejy ity raha manana fanontaniana ankapobeny amin'ny tanàna ianao. Raha fangatahana arahina dia ampiasao Ny fangatahako."
  },
};

function getPageHelp(locale) {
  const path = window.location.pathname;
  const exact = PAGE_HELP[path];
  if (exact) return exact[locale] || exact.fr;
  if (path.startsWith("/citizen/services/")) return locale==="en" ? "You are viewing a city service. Review its information, then start a request if needed." : locale==="mg" ? "Mijery sampan-draharaha iray ianao. Vakio ny vaovao momba azy ary manaova fangatahana raha ilaina." : "Vous consultez un service municipal. Vérifiez ses informations puis lancez une demande si nécessaire.";
  if (path.startsWith("/citizen/requests/")) return locale==="en" ? "You are viewing one request and its progress." : locale==="mg" ? "Mijery fangatahana iray sy ny fivoarany ianao." : "Vous consultez une demande et son avancement.";
  return "";
}

function routeFromSpeech(text) {
  const value = text.toLowerCase();
  if (/nouvelle demande|new request|fangatahana vaovao/.test(value)) return "/citizen/requests?new=1";
  if (/demande|request|fangata/.test(value)) return "/citizen/requests";
  if (/service|sampan/.test(value)) return "/citizen/services";
  if (/actualit|news|vaovao/.test(value)) return "/citizen/news";
  if (/contact|aide|help|hifandray|fanamp/.test(value)) return "/citizen/help";
  if (/profil|profile|mombamomba/.test(value)) return "/citizen/profile";
  if (/notification|fampahafantarana/.test(value)) return "/citizen/notifications";
  if (/accueil|dashboard|tabilao|home/.test(value)) return "/citizen";
  return null;
}

export default function VoiceControl() {
  const [locale] = useLocale();
  const copy = COPY[locale] || COPY.fr;
  const [open,setOpen]=useState(false);
  const [listening,setListening]=useState(false);
  const [message,setMessage]=useState("");
  const recognitionRef=useRef(null);
  const speechLang = locale==="en" ? "en-US" : locale==="mg" ? "mg-MG" : "fr-FR";
  const supported = useMemo(() => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition), []);

  useEffect(()=>()=>{recognitionRef.current?.stop?.();window.speechSynthesis?.cancel?.();},[]);

  function speak() {
    const text=getPageHelp(locale) || copy.hint;
    if(!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(text);
    utterance.lang=speechLang;
    utterance.rate=.96;
    window.speechSynthesis.speak(utterance);
  }

  function stop() {
    recognitionRef.current?.stop?.();
    window.speechSynthesis?.cancel?.();
    setListening(false);
  }

  function startListening() {
    if(!supported){setMessage(copy.unsupported);return}
    const SpeechRecognition=window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition=new SpeechRecognition();
    recognition.lang=speechLang;
    recognition.interimResults=false;
    recognition.continuous=false;
    recognition.maxAlternatives=1;
    recognition.onstart=()=>{setListening(true);setMessage(copy.listening)};
    recognition.onend=()=>setListening(false);
    recognition.onerror=()=>{setListening(false);setMessage(copy.unsupported)};
    recognition.onresult=(event)=>{
      const text=event.results?.[0]?.[0]?.transcript || "";
      setMessage(`${copy.heard} : « ${text} »`);
      const route=routeFromSpeech(text);
      if(route) {
        window.setTimeout(()=>navigate(route),350);
        return;
      }

      const path=window.location.pathname;
      if(path==="/citizen/requests" || path==="/citizen/help") {
        window.dispatchEvent(new CustomEvent("nova-terra-voice-dictation",{detail:{text,path}}));
        setMessage(`${copy.heard} : « ${text} »`);
        return;
      }

      window.setTimeout(()=>setMessage(`${copy.heard} : « ${text} » — ${copy.unknown}`),100);
    };
    recognitionRef.current=recognition;
    recognition.start();
  }

  return <>
    <button type="button" className={`portal-voice-trigger ${open?"is-open":""}`} onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-controls="portal-voice-panel" title={copy.button}>
      <span aria-hidden="true">◉</span><b>{copy.button}</b>
    </button>
    {open ? <section className="portal-voice-panel" id="portal-voice-panel" aria-label={copy.title}>
      <div className="portal-voice-panel__head">
        <div><span>{copy.title}</span><small>{copy.hint}</small></div>
        <button type="button" onClick={()=>{stop();setOpen(false)}} aria-label={copy.close}>×</button>
      </div>
      <div className="portal-voice-panel__actions">
        <button type="button" className="secondary-action" onClick={speak}>▶ {copy.read}</button>
        <button type="button" className={listening?"primary-action is-listening":"primary-action"} onClick={listening?stop:startListening}>{listening ? `■ ${copy.stop}` : `● ${copy.listen}`}</button>
      </div>
      {message ? <p className="portal-voice-panel__status" aria-live="polite">{message}</p> : null}
    </section> : null}
  </>;
}

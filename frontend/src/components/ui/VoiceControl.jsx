import { useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "../../utils/navigation.js";
import { useLocale } from "../../utils/i18n.js";
import robotModelUrl from "../../assets/assistant/robotanimation.glb?url";
import "../../styles/app-shell.css";

const COPY = {
  fr:{
    button:"Mode vocal",
    title:"Assistant vocal",
    live:"En écoute…",
    ready:"Prêt à vous guider",
    intro:"Bonjour, je suis votre assistant vocal Nova Terra. Décrivez simplement votre besoin et je vous oriente.",
    listen:"Écouter",
    stop:"Arrêter",
    read:"Lire l’aide",
    close:"Fermer",
    unsupported:"L’entrée vocale n’est pas disponible ici. L’assistant peut toujours vous lire l’aide.",
    hint:"Dites par exemple « mes demandes », « services », « rendez-vous », « actualités », « nous contacter » ou « profil ».",
    listening:"Je vous écoute…",
    speaking:"Je vous parle…",
    noSpeech:"Je n’ai rien entendu. Appuyez sur Écouter et réessayez.",
    heard:"J’ai entendu",
    unknown:"Commande non reconnue.",
    welcomePill:"Je vous écoute…",
    activate:"Activer le mode vocal",
    micLabel:"Microphone",
    modelFallback:"Robot en chargement…"
  },
  en:{
    button:"Voice mode",
    title:"Voice assistant",
    live:"Listening…",
    ready:"Ready to guide you",
    intro:"Hello, I am your Nova Terra voice assistant. Tell me what you need and I will guide you.",
    listen:"Listen",
    stop:"Stop",
    read:"Read help",
    close:"Close",
    unsupported:"Voice input is not available here. The assistant can still read guidance aloud.",
    hint:"Try saying “my requests”, “services”, “appointments”, “news”, “contact us” or “profile”.",
    listening:"Listening…",
    speaking:"I’m speaking…",
    noSpeech:"I didn’t hear anything. Press Listen and try again.",
    heard:"I heard",
    unknown:"Command not recognized.",
    welcomePill:"I’m listening…",
    activate:"Enable voice mode",
    micLabel:"Microphone",
    modelFallback:"Loading robot…"
  },
  mg:{
    button:"Fomba feo",
    title:"Mpanampy amin'ny feo",
    live:"Mihaino…",
    ready:"Vonona hanampy anao",
    intro:"Salama, izaho no mpanampy amin'ny feo Nova Terra. Lazao izay ilainao dia hitari-dalana anao aho.",
    listen:"Hihaino",
    stop:"Ajanony",
    read:"Vakio ny fanampiana",
    close:"Hakatona",
    unsupported:"Tsy misy fidirana amin’ny feo eto. Mbola afaka mamaky ny fanampiana aminao ilay mpanampy.",
    hint:"Azonao lazaina hoe « fangatahako », « sampan-draharaha », « fotoana fihaonana », « vaovao », « hifandray aminay » na « profil ».",
    listening:"Mihaino aho…",
    speaking:"Miresaka aminao aho…",
    noSpeech:"Tsy naheno teny aho. Tsindrio Hihaino ary avereno indray.",
    heard:"Henoko",
    unknown:"Tsy fantatra ilay baiko.",
    welcomePill:"Mihaino anao aho…",
    activate:"Alefaso ny maody feo",
    micLabel:"Mikrô",
    modelFallback:"Eo am-pitondrana ny robot…"
  },
};

const PAGE_HELP = {
  "/citizen": {
    fr:"Vous êtes sur votre tableau de bord. Vous pouvez suivre vos demandes, ouvrir un service prioritaire ou créer une nouvelle demande.",
    en:"You are on your dashboard. You can track requests, open a priority service or create a new request.",
    mg:"Ao amin'ny tabilao ianao. Afaka manara-maso fangatahana, manokatra sampan-draharaha na mamorona fangatahana vaovao."
  },
  "/citizen/signalements": {
    fr:"Choisissez le type de problème, indiquez précisément le lieu ou utilisez votre position GPS, puis décrivez ce que vous observez.",
    en:"Choose the problem type, enter the exact location or use your GPS position, then describe what you can see.",
    mg:"Safidio ny karazana olana, lazao mazava ny toerana na ampiasao ny GPS, ary hazavao izay hitanao."
  },
  "/citizen/requests": {
    fr:"Ici, vous retrouvez toutes vos demandes. Utilisez Nouvelle demande pour écrire puis envoyer votre besoin.",
    en:"Here you can find all your requests. Use New request to write and send what you need.",
    mg:"Eto no ahitanao ny fangatahanao rehetra. Ampiasao ny Fangatahana vaovao mba hanoratra sy handefa ny filànao."
  },
  "/citizen/transport": {
    fr:"Consultez les lignes et arrêts de transport. Utilisez Autour de moi pour chercher les arrêts proches de votre position.",
    en:"Browse transport lines and stops. Use Near me to find stops close to your position.",
    mg:"Jereo ny zotra sy ny fijanonana. Ampiasao Akaiky ahy hitadiavana fijanonana manodidina anao."
  },
  "/citizen/services": {
    fr:"Ouvrez un service pour voir ses horaires, ses coordonnées, les démarches disponibles et les documents requis.",
    en:"Open a service to see its hours, contact details, available procedures and required documents.",
    mg:"Sokafy ny sampan-draharaha iray mba hahitana ny ora fiasana, fifandraisana, dingana azo atao ary taratasy ilaina."
  },
  "/citizen/appointments": {
    fr:"Choisissez un service, une date et un créneau disponible. Les créneaux réservés ou indisponibles sont clairement désactivés. Vous pouvez aussi activer un rappel.",
    en:"Choose a service, date and available time slot. Booked or unavailable slots are clearly disabled. You can also enable a reminder.",
    mg:"Safidio ny sampan-draharaha, daty ary ora misy. Tsy azo tsindriana ny ora efa voatokana na tsy misy. Afaka mampandeha fampahatsiahivana koa ianao."
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
  if (/signalement|signaler|report|tatitra/.test(value)) return "/citizen/signalements";
  if (/demande|request|fangata/.test(value)) return "/citizen/requests";
  if (/transport|bus|mobilit|fitaterana/.test(value)) return "/citizen/transport";
  if (/service|sampan/.test(value)) return "/citizen/services";
  if (/rendez|appointment|fihaonana|fotoana/.test(value)) return "/citizen/appointments";
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
  const [scriptLine,setScriptLine]=useState("");
  const [speaking,setSpeaking]=useState(false);
  const [modelViewerReady,setModelViewerReady]=useState(false);
  const recognitionRef=useRef(null);
  const introTimeoutRef = useRef(null);
  const typeIntervalRef = useRef(null);
  const speechLang = locale==="en" ? "en-US" : locale==="mg" ? "mg-MG" : "fr-FR";
  const supported = useMemo(() => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition), []);

  useEffect(() => {
    if (typeof window === "undefined" || !open) return undefined;
    if (window.customElements?.get("model-viewer")) {
      setModelViewerReady(true);
      return undefined;
    }
    setModelViewerReady(false);
    const existing = document.querySelector('script[data-model-viewer="nova-terra"]');
    if (existing) {
      existing.addEventListener("load", () => setModelViewerReady(true), { once:true });
      return undefined;
    }
    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    script.dataset.modelViewer = "nova-terra";
    script.onload = () => setModelViewerReady(true);
    document.head.appendChild(script);
    return undefined;
  }, [open]);

  useEffect(()=>()=>{
    recognitionRef.current?.stop?.();
    window.speechSynthesis?.cancel?.();
    window.clearTimeout(introTimeoutRef.current);
    window.clearInterval(typeIntervalRef.current);
  },[]);

  function typeScript(text) {
    window.clearInterval(typeIntervalRef.current);
    setScriptLine("");
    let index = 0;
    typeIntervalRef.current = window.setInterval(() => {
      index += 1;
      setScriptLine(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(typeIntervalRef.current);
      }
    }, 16);
  }

  function speak(text, { listenAfter = false } = {}) {
    const sentence = text || getPageHelp(locale) || copy.hint;
    if(!window.speechSynthesis) {
      setMessage(sentence);
      typeScript(sentence);
      if(listenAfter) window.setTimeout(startListening, 180);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(sentence);
    utterance.lang=speechLang;
    utterance.rate=.96;
    utterance.pitch=1.02;
    utterance.onstart=()=>setSpeaking(true);
    utterance.onend=()=>{
      setSpeaking(false);
      if(listenAfter) window.setTimeout(startListening, 180);
    };
    utterance.onerror=()=>{
      setSpeaking(false);
      if(listenAfter) window.setTimeout(startListening, 180);
    };
    setMessage(sentence);
    typeScript(sentence);
    window.speechSynthesis.speak(utterance);
  }

  function stop() {
    recognitionRef.current?.stop?.();
    window.speechSynthesis?.cancel?.();
    window.clearTimeout(introTimeoutRef.current);
    setListening(false);
    setSpeaking(false);
  }

  function startListening() {
    if(!supported){setMessage(copy.unsupported);setScriptLine(copy.unsupported);return}
    window.speechSynthesis?.cancel?.();
    setSpeaking(false);
    const SpeechRecognition=window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition=new SpeechRecognition();
    recognition.lang=speechLang;
    recognition.interimResults=false;
    recognition.continuous=false;
    recognition.maxAlternatives=1;
    recognition.onstart=()=>{setListening(true);setMessage(copy.listening);setScriptLine(copy.listening)};
    recognition.onend=()=>setListening(false);
    recognition.onerror=()=>{setListening(false);setMessage(copy.unsupported);setScriptLine(copy.unsupported)};
    recognition.onresult=(event)=>{
      const text=String(event.results?.[0]?.[0]?.transcript || "").trim();

      if(!text){
        setMessage(copy.noSpeech);
        setScriptLine(copy.noSpeech);
        return;
      }

      const heardMessage = `${copy.heard} : « ${text} »`;
      setMessage(heardMessage);
      setScriptLine(heardMessage);
      const route=routeFromSpeech(text);
      if(route) {
        window.setTimeout(()=>navigate(route),350);
        return;
      }

      const path=window.location.pathname;
      if(path==="/citizen/requests" || path==="/citizen/help") {
        window.dispatchEvent(new CustomEvent("nova-terra-voice-dictation",{detail:{text,path}}));
        return;
      }

      window.setTimeout(()=>{
        const unknownMessage = `${copy.heard} : « ${text} » — ${copy.unknown}`;
        setMessage(unknownMessage);
        setScriptLine(unknownMessage);
      },100);
    };
    recognitionRef.current=recognition;
    recognition.start();
  }

  function activatePanel() {
    if (open) {
      stop();
      setOpen(false);
      return;
    }
    setOpen(true);
    const intro = copy.intro;
    setMessage(intro);
    typeScript(intro);
    window.clearTimeout(introTimeoutRef.current);
    speak(intro, { listenAfter: supported });
  }

  const visualActive = open && (listening || speaking);
  const liveLabel = listening ? copy.live : speaking ? copy.speaking : copy.ready;
  const helperText = scriptLine || message || copy.hint;

  return <>
    <button
      type="button"
      className={`portal-voice-trigger ${open?"is-open":""}`}
      onClick={activatePanel}
      aria-expanded={open}
      aria-controls="portal-voice-panel"
      title={copy.activate}
    >
      <span aria-hidden="true">◉</span><b>{copy.button}</b>
    </button>

    {open ? <section className="portal-voice-panel portal-voice-panel--robot" id="portal-voice-panel" aria-label={copy.title}>
      <div className="portal-voice-panel__head">
        <div className="portal-voice-panel__head-copy">
          <span className="portal-voice-panel__icon" aria-hidden="true">◌</span>
          <div>
            <strong>{copy.title}</strong>
            <small className={listening ? "is-live" : ""}>{liveLabel}</small>
          </div>
        </div>
        <button type="button" onClick={()=>{stop();setOpen(false)}} aria-label={copy.close}>×</button>
      </div>

      <div className={`portal-voice-panel__stage ${visualActive ? "is-active" : ""}`}>
        <div className="portal-voice-panel__wave portal-voice-panel__wave--left" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>

        <div className="portal-voice-panel__robot-shell" aria-hidden="true">
          {modelViewerReady
            ? <model-viewer
                src={robotModelUrl}
                autoplay
                animation-name="talking"
                interaction-prompt="none"
                shadow-intensity="0.45"
                exposure="1.08"
                camera-controls={false}
                disable-zoom
                disable-pan
                camera-target="0m 0.9m 0m"
                camera-orbit="0deg 78deg 0.95m"
                field-of-view="26deg"
              />
            : <div className="portal-voice-panel__robot-fallback">{copy.modelFallback}</div>}
        </div>

        <div className="portal-voice-panel__wave portal-voice-panel__wave--right" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>
      </div>

      <div className="portal-voice-panel__script" aria-live="polite">{helperText}</div>

      <div className="portal-voice-panel__actions">
        <button type="button" className="secondary-action" onClick={()=>speak()}>{copy.read}</button>
        <button
          type="button"
          className={listening?"primary-action is-listening":"primary-action"}
          onClick={listening?stop:startListening}
          disabled={!supported && !listening}
          title={!supported ? copy.unsupported : copy.listen}
        >
          {listening ? copy.stop : copy.listen}
        </button>
      </div>

      <div className="portal-voice-panel__foot-note">
        <span className={listening ? "is-live" : ""}>{listening ? copy.welcomePill : copy.hint}</span>
      </div>
    </section> : null}
  </>;
}

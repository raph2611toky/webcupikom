import { useEffect, useMemo, useRef, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { createCitizenRequest, getCitizenReportCategories, getCitizenRequests } from "../../api/requests.js";
import { REPORT_TYPES } from "../../constants/requestOptions.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import useRealtimeRefresh from "../../realtime/useRealtimeRefresh.js";
import { getApiErrorMessage } from "../../api/auth.js";

const COPY = {
  fr:{
    eyebrow:"Intervention municipale",title:"Signaler un problème",introTitle:"Que souhaitez-vous signaler ?",
    intro:"Choisissez le type de problème, indiquez précisément où il se trouve puis décrivez ce que vous observez.",
    type:"Type de signalement",where:"Où se trouve le problème ?",location:"Adresse, rue ou repère",
    locationPh:"Ex. Rue Helios, devant le bâtiment 14",sector:"Quartier / secteur",sectorPh:"Ex. Quartier Sud",
    usePosition:"Utiliser ma position",locating:"Localisation…",positionReady:"Position GPS ajoutée",
    positionDenied:"Impossible d’obtenir votre position. Vous pouvez saisir le lieu manuellement.",
    describe:"Décrire le problème",subject:"Titre court",subjectPh:"Ex. Lampadaire cassé",
    details:"Que se passe-t-il ?",detailsPh:"Décrivez ce que vous voyez et ce qui doit être corrigé.",
    photo:"Photo ou document",photoHelp:"Une photo aide l’agent à comprendre le problème.",
    priority:"Importance",normal:"Normale",important:"Gênante / importante",danger:"Danger potentiel",
    summary:"Vérifier avant d’envoyer",service:"Service destinataire",send:"Envoyer le signalement",
    sending:"Envoi…",success:"Signalement envoyé",successText:"Votre signalement est enregistré. Vous pouvez suivre son traitement dans votre historique.",
    track:"Suivre le signalement →",history:"Mes signalements",empty:"Vous n’avez encore envoyé aucun signalement.",
    status:"Statut",place:"Lieu",open:"Ouvrir",error:"Impossible d’envoyer le signalement.",
    locationRequired:"Indiquez où se trouve le problème avant l’envoi.",back:"Retour",next:"Continuer",step:"Étape",of:"sur",reviewHint:"Vérifiez les informations avant l’envoi."
  },
  en:{
    eyebrow:"City intervention",title:"Report a problem",introTitle:"What would you like to report?",
    intro:"Choose the type of problem, show exactly where it is, then describe what you can see.",
    type:"Report type",where:"Where is the problem?",location:"Address, street or landmark",
    locationPh:"E.g. Helios Street, in front of building 14",sector:"District / area",sectorPh:"E.g. South District",
    usePosition:"Use my location",locating:"Locating…",positionReady:"GPS position added",
    positionDenied:"Unable to get your position. You can enter the location manually.",
    describe:"Describe the problem",subject:"Short title",subjectPh:"E.g. broken street light",
    details:"What is happening?",detailsPh:"Describe what you see and what needs to be fixed.",
    photo:"Photo or document",photoHelp:"A photo can help the agent understand the problem.",
    priority:"Importance",normal:"Normal",important:"Important disruption",danger:"Potential danger",
    summary:"Check before sending",service:"Destination service",send:"Send report",
    sending:"Sending…",success:"Report sent",successText:"Your report has been recorded. You can track it in your history.",
    track:"Track report →",history:"My reports",empty:"You have not sent any reports yet.",
    status:"Status",place:"Location",open:"Open",error:"Unable to send the report.",
    locationRequired:"Enter where the problem is before sending.",back:"Back",next:"Continue",step:"Step",of:"of",reviewHint:"Check the information before sending."
  },
  mg:{
    eyebrow:"Fidirana an-tsehatry ny tanàna",title:"Hitatitra olana",introTitle:"Inona no olana tianao hotaterina?",
    intro:"Safidio ny karazana olana, lazao mazava ny toerana misy azy ary hazavao izay hitanao.",
    type:"Karazana tatitra",where:"Aiza no misy ny olana?",location:"Adiresy, arabe na toerana famantarana",
    locationPh:"Ohatra: Rue Helios, eo anoloan'ny trano 14",sector:"Faritra / quartier",sectorPh:"Ohatra: Quartier Sud",
    usePosition:"Ampiasao ny toerana misy ahy",locating:"Mitady toerana…",positionReady:"Nampidirina ny toerana GPS",
    positionDenied:"Tsy afaka mahazo ny toerana GPS. Azonao soratana tanana ny toerana.",
    describe:"Hazavao ny olana",subject:"Lohateny fohy",subjectPh:"Ohatra: jiro an-dalambe simba",
    details:"Inona no mitranga?",detailsPh:"Hazavao izay hitanao sy izay tokony hamboarina.",
    photo:"Sary na rakitra",photoHelp:"Manampy ny agent hahatakatra ny olana ny sary.",
    priority:"Lanja",normal:"Mahazatra",important:"Manelingelina / lehibe",danger:"Mety hampidi-doza",
    summary:"Hamarino alohan'ny handefasana",service:"Sampan-draharaha handray",send:"Handefa ny tatitra",
    sending:"Mandefa…",success:"Nalefa ny tatitra",successText:"Voaray ny tatitrao. Azonao arahana ao amin'ny tantaranao ny fikarakarana azy.",
    track:"Hanaraka ny tatitra →",history:"Ny tatitra nataoko",empty:"Tsy mbola nandefa tatitra ianao.",
    status:"Sata",place:"Toerana",open:"Hanokatra",error:"Tsy afaka mandefa ny tatitra.",
    locationRequired:"Lazao ny toerana misy ny olana alohan'ny handefasana.",back:"Hiverina",next:"Hanohy",step:"Dingana",of:"amin'ny",reviewHint:"Hamarino ny vaovao alohan'ny handefasana."
  }
};

const REPORT_HELPERS = {
  en:{
    street_light:"Street light off, flashing or damaged",
    road:"Pothole, obstacle, pavement or road equipment",
    water:"Leak, water flow, pipe or sanitation problem",
    waste:"Waste deposit, collection or cleanliness problem",
    transport:"Stop, route, equipment or mobility incident",
    safety:"Hazard that requires city intervention",
    public_space:"Damaged public furniture, building or equipment",
    other:"Any other problem to report to the city",
  },
  mg:{
    street_light:"Jiro an-dalambe maty, mikopakopaka na simba",
    road:"Lavaka, sakana, arabe na fitaovan-dalana simba",
    water:"Fivoahan-drano, fantsona na olana amin'ny fanadiovana",
    waste:"Fako, fanangonana na olana amin'ny fahadiovana",
    transport:"Fiatoana, zotra, fitaovana na olana amin'ny fitaterana",
    safety:"Toe-javatra mety hampidi-doza mila fidiran'ny tanàna",
    public_space:"Fitaovana na trano ho an'ny daholobe simba",
    other:"Olana hafa rehetra tianao hotaterina amin'ny tanàna",
  }
};

function helperReport(item, locale){
  return REPORT_HELPERS[locale]?.[item.value] || item.helper;
}

const REPORT_LABELS = {
  en:{
    "Éclairage / lampadaire":"Street lighting / lamp",
    "Voirie / chaussée":"Road / pavement",
    "Eau / fuite":"Water / leak",
    "Déchets / propreté":"Waste / cleanliness",
    "Transport":"Transport",
    "Sécurité / danger":"Safety / hazard",
    "Espace public / bâtiment":"Public space / building",
    "Autre problème":"Other problem"
  },
  mg:{
    "Éclairage / lampadaire":"Jiro an-dalambe",
    "Voirie / chaussée":"Lalana / arabe",
    "Eau / fuite":"Rano / fivoahana",
    "Déchets / propreté":"Fako / fahadiovana",
    "Transport":"Fitaterana",
    "Sécurité / danger":"Fiarovana / loza",
    "Espace public / bâtiment":"Toerana ho an'ny daholobe / trano",
    "Autre problème":"Olana hafa"
  }
};

function labelReport(item, locale){
  return DYNAMIC_LABELS[locale]?.[item.value] || REPORT_LABELS[locale]?.[item.label] || item.label;
}

const BACKEND_REPORT_UI = {
  street_lighting:{icon:"✦",helper:"Lampadaire éteint, clignotant ou endommagé"},
  road_damage:{icon:"⌁",helper:"Trou, obstacle, trottoir ou chaussée dégradée"},
  waste:{icon:"▧",helper:"Dépôt, collecte ou problème de propreté"},
  water_leak:{icon:"◒",helper:"Fuite, écoulement ou canalisation endommagée"},
  green_spaces:{icon:"♧",helper:"Arbre, parc ou espace vert à entretenir"},
  accessibility:{icon:"♿",helper:"Obstacle ou équipement qui limite l’accessibilité"},
  public_safety:{icon:"!",helper:"Situation dangereuse dans l’espace public"},
  medical_emergency:{icon:"+",helper:"Urgence médicale nécessitant une intervention prioritaire"},
  fire_emergency:{icon:"△",helper:"Incendie, fumée ou départ de feu"},
  immediate_danger:{icon:"!",helper:"Danger immédiat pour les personnes ou les biens"},
  building:{icon:"⌂",helper:"Bâtiment ou équipement municipal dégradé"},
  other:{icon:"+",helper:"Tout autre problème à signaler à la ville"},
};

const DYNAMIC_LABELS = {
  en:{
    street_lighting:"Street lighting",road_damage:"Road and pavement",waste:"Waste and cleanliness",water_leak:"Water leak",green_spaces:"Green spaces",
    accessibility:"Public-space accessibility",public_safety:"Public safety",medical_emergency:"Medical emergency",fire_emergency:"Fire emergency",
    immediate_danger:"Immediate danger",building:"Municipal building / equipment",other:"Other problem"
  },
  mg:{
    street_lighting:"Jiro an-dalambe",road_damage:"Lalana sy arabe",waste:"Fako sy fahadiovana",water_leak:"Fivoahan-drano",green_spaces:"Toerana maitso",
    accessibility:"Fahafahana miditra amin'ny toerana ho an'ny daholobe",public_safety:"Fiarovana eny amin'ny toerana ho an'ny daholobe",
    medical_emergency:"Vonjy taitra ara-pahasalamana",fire_emergency:"Afo / firehetana",immediate_danger:"Loza eo noho eo",building:"Trano na fitaovan'ny tanàna",other:"Olana hafa"
  }
};

function backendReportType(item){
  const preset=BACKEND_REPORT_UI[item?.code]||BACKEND_REPORT_UI.other;
  return {
    value:item?.code||"other",
    label:item?.label||"Autre problème",
    icon:preset.icon,
    category:item?.label||"Autre",
    service:item?.suggested_service||"",
    serviceName:item?.suggested_service_name||"",
    helper:preset.helper,
    emergency:Boolean(item?.emergency),
    alerting:item?.alerting||"standard",
    needsTriage:Boolean(item?.needs_triage),
  };
}

function getReportPrefill(){
  const params=new URLSearchParams(window.location.search);
  return {
    category:params.get("category")||"",
    message:params.get("message")||"",
    subject:params.get("subject")||"",
  };
}

export default function CitizenReports(){
  const {user}=useAuth();
  const [locale]=useLocale();
  const copy=COPY[locale]||COPY.fr;
  const prefill=useMemo(()=>getReportPrefill(),[]);
  const [reportType,setReportType]=useState(prefill.category||REPORT_TYPES[0].value);
  const [subject,setSubject]=useState(prefill.subject);
  const [message,setMessage]=useState(prefill.message);
  const [sector,setSector]=useState("");
  const [location,setLocation]=useState("");
  const [coordinates,setCoordinates]=useState(null);
  const [priority,setPriority]=useState("normal");
  const [file,setFile]=useState(null);
  const [locating,setLocating]=useState(false);
  const [sending,setSending]=useState(false);
  const [created,setCreated]=useState(null);
  const [error,setError]=useState("");
  const [items,setItems]=useState([]);
  const [step,setStep]=useState(1);
  const [reportMeta,setReportMeta]=useState({categories:[],limits:{},locationRule:"",dangerGuidance:""});
  const fileRef=useRef(null);

  const reportTypes=useMemo(()=>{
    if(reportMeta.categories.length) return reportMeta.categories.map(backendReportType);
    return REPORT_TYPES.map(item=>({...item,emergency:false,serviceName:item.service}));
  },[reportMeta.categories]);

  const selected=useMemo(
    ()=>reportTypes.find(item=>item.value===reportType)||reportTypes[0]||REPORT_TYPES[0],
    [reportType,reportTypes]
  );

  async function refresh(){
    try{
      const rows=await getCitizenRequests({type:"report",page_size:50,ordering:"-updated_at"});
      setItems(rows);
    }catch{}
  }

  useEffect(()=>{
    refresh();
    getCitizenReportCategories().then(setReportMeta).catch(()=>{});
  },[]);

  useRealtimeRefresh("nova-reports-updated", ()=>refresh());

  useEffect(()=>{
    if(reportTypes.length&&!reportTypes.some(item=>item.value===reportType)){
      setReportType(reportTypes[0].value);
    }
  },[reportTypes,reportType]);

  useEffect(()=>{
    if(selected?.emergency) setPriority("danger");
  },[selected?.value,selected?.emergency]);

  function usePosition(){
    setError("");
    if(!navigator.geolocation){
      setError(copy.positionDenied);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos=>{
        setCoordinates({
          latitude:Number(pos.coords.latitude.toFixed(6)),
          longitude:Number(pos.coords.longitude.toFixed(6)),
          accuracy:Math.round(pos.coords.accuracy||0),
        });
        if(!location)setLocation(locale==="en"?"GPS position":locale==="mg"?"Toerana GPS":"Position GPS transmise");
        setLocating(false);
      },
      ()=>{
        setError(copy.positionDenied);
        setLocating(false);
      },
      {enableHighAccuracy:true,timeout:10000,maximumAge:60000}
    );
  }

  async function submit(event){
    event.preventDefault();
    setError("");
    if(!location.trim()&&!coordinates){
      setError(copy.locationRequired);
      return;
    }

    setSending(true);
    try{
      const label=[sector.trim(),location.trim()].filter(Boolean).join(" · ") || "Position GPS transmise";
      const normalized=(value)=>String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
      const backendCategory=reportMeta.categories.find(item=>item.code===selected.value)||reportMeta.categories.find(item=>{
        const hay=[item.code,item.label].map(normalized);
        const wanted=[selected.value,selected.label,selected.category].map(normalized);
        return hay.some(a=>wanted.some(b=>a===b||a.includes(b)||b.includes(a)));
      });
      const request=await createCitizenRequest({
        source:"citizen-report",
        type:"signalement",
        requestType:"report",
        incidentCategory:backendCategory?.code||normalized(selected.category).replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,""),
        category:selected.category,
        service:backendCategory?.suggested_service||selected.service,
        subject:subject.trim()||backendCategory?.label||selected.label,
        message:message.trim(),
        district:sector.trim(),
        severity:priority==="danger"?"critical":priority==="important"?"major":"moderate",
        dangerPresent:priority==="danger",
        frequency:"once",
        location:{label,...(coordinates||{})},
        images:file?[file]:[],
        imageCaptions:file?[subject.trim()||selected.label]:[],
      });
      setCreated(request);
      await refresh();
    }catch(err){
      setError(getApiErrorMessage(err,copy.error));
    }finally{
      setSending(false);
    }
  }

  function reset(){
    setCreated(null);
    setSubject("");
    setMessage("");
    setSector("");
    setLocation("");
    setCoordinates(null);
    setPriority("normal");
    setFile(null);
    setError("");
    setStep(1);
  }

  function goNext(){
    setError("");
    if(step===2 && !location.trim() && !coordinates){
      setError(copy.locationRequired);
      return;
    }
    if(step===3 && !message.trim()){
      setError(locale==="en"?"Describe the problem before continuing.":locale==="mg"?"Hazavao aloha ny olana.":"Décrivez le problème avant de continuer.");
      return;
    }
    setStep(current=>Math.min(4,current+1));
  }

  function goBack(){
    setError("");
    setStep(current=>Math.max(1,current-1));
  }

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow={copy.eyebrow} title={copy.title} actions={<button type="button" className="topbar-ghost" onClick={()=>navigate("/citizen/requests/support")}>♡ Soutenir un signalement</button>}/>
      <main className="portal-content report-page report-page--wizard">
        <section className="report-layout report-layout--wizard">
          <form className="portal-card report-form report-form--wizard" onSubmit={submit}>
            {created ? <div className="report-success" role="status" aria-live="polite">
              <i aria-hidden="true">✓</i>
              <span className="section-label">{copy.success}</span>
              <h2>{created.reference}</h2>
              <p>{created.confirmation?.message||copy.successText}</p>
              <div className="report-success__facts">
                <div><span>{copy.type}</span><b>{created.reportType||selected.label}</b></div>
                <div><span>{copy.place}</span><b>{created.location?.label||"—"}</b></div>
                <div><span>{copy.status}</span><b>{created.status||"En attente"}</b></div>
              </div>
              <div className="report-success__actions">
                <button className="secondary-action" type="button" onClick={reset}>Nouveau signalement</button>
                <button className="primary-action" type="button" onClick={()=>navigate(`/citizen/requests/${encodeURIComponent(created.reference)}`)}>{copy.track}</button>
              </div>
            </div> : <>
              <div className="report-wizard-head">
                <div>
                  <span className="section-label">{copy.step} {step} {copy.of} 4</span>
                  <h2>{step===1?copy.type:step===2?copy.where:step===3?copy.describe:copy.summary}</h2>
                  <p>{step===1?helperReport(selected,locale):step===2?copy.locationRequired:step===3?selected.label:copy.reviewHint}</p>
                </div>
                <div className="report-wizard-progress" aria-label={`${copy.step} ${step} ${copy.of} 4`}>
                  {[1,2,3,4].map(item=><span key={item} className={item<=step?"is-done":""}><i>{item}</i></span>)}
                </div>
              </div>

              {step===1 ? <section className="report-step report-step--active">
                <div className="report-type-grid report-type-grid--wizard">
                  {reportTypes.map(item=><button
                    type="button"
                    key={item.value}
                    className={`${reportType===item.value?"is-active":""}${item.emergency?" is-emergency":""}`}
                    aria-pressed={reportType===item.value}
                    onClick={()=>setReportType(item.value)}
                  >
                    <i aria-hidden="true">{item.icon}</i>
                    <div><b>{labelReport(item,locale)}{item.emergency?<em>Urgence</em>:null}</b><span>{helperReport(item,locale)}</span></div>
                  </button>)}
                </div>
              </section> : null}

              {step===2 ? <section className="report-step report-step--active">
                <div className="report-location-grid">
                  <label><span>{copy.sector}</span><input value={sector} onChange={e=>setSector(e.target.value)} placeholder={copy.sectorPh}/></label>
                  <label><span>{copy.location}</span><input value={location} onChange={e=>setLocation(e.target.value)} placeholder={copy.locationPh}/></label>
                </div>
                <div className="report-geolocation">
                  <button type="button" className="secondary-action" onClick={usePosition} disabled={locating}>
                    {locating?copy.locating:`⌖ ${copy.usePosition}`}
                  </button>
                  {coordinates?<div className="report-coordinate-chip"><i>✓</i><div><b>{copy.positionReady}</b><span>{coordinates.latitude}, {coordinates.longitude} · ±{coordinates.accuracy} m</span></div></div>:null}
                </div>
              </section> : null}

              {step===3 ? <section className="report-step report-step--active">
                <div className="report-description-grid">
                  <label><span>{copy.subject}</span><input value={subject} onChange={e=>setSubject(e.target.value)} placeholder={copy.subjectPh}/></label>
                  <label><span>{copy.details}</span><textarea rows="4" required value={message} onChange={e=>setMessage(e.target.value)} placeholder={copy.detailsPh}/></label>
                </div>

                <div className="report-priority">
                  <span>{copy.priority}</span>
                  <div>
                    {[["normal",copy.normal],["important",copy.important],["danger",copy.danger]].map(([value,label])=><button type="button" key={value} className={priority===value?"is-active":""} aria-pressed={priority===value} disabled={selected.emergency&&value!=="danger"} onClick={()=>setPriority(value)}>{label}</button>)}
                  </div>
                </div>
                {selected.emergency?<div className="report-emergency-note" role="status"><b>Priorité critique automatique</b><span>{reportMeta.dangerGuidance||"Cette catégorie déclenche un circuit municipal prioritaire."}</span></div>:null}

                <div className="report-file">
                  <div><b>{copy.photo}</b><span>{reportMeta.limits?.image_max_bytes?`${copy.photoHelp} · max ${Math.round(reportMeta.limits.image_max_bytes/1024/1024)} Mo`:copy.photoHelp}</span></div>
                  <input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/>
                  <button type="button" className="secondary-action" onClick={()=>fileRef.current?.click()}>{file?`✓ ${file.name}`:"+ Ajouter"}</button>
                </div>
              </section> : null}

              {step===4 ? <section className="report-step report-step--active report-review">
                <div className="report-review-grid">
                  <div><span>{copy.type}</span><b>{labelReport(selected,locale)}</b></div>
                  <div><span>{copy.place}</span><b>{[sector,location].filter(Boolean).join(" · ")||copy.positionReady}</b></div>
                  <div><span>{copy.service}</span><b>{selected.serviceName||selected.service||"Attribution municipale"}</b></div>
                  <div><span>{copy.priority}</span><b>{priority==="danger"?copy.danger:priority==="important"?copy.important:copy.normal}</b></div>
                  <div className="span-2"><span>{copy.details}</span><b>{message}</b></div>
                </div>
              </section> : null}

              {error?<div className="error-card report-wizard-error" role="alert">{error}</div>:null}

              <div className="report-wizard-actions">
                {step>1?<button className="secondary-action" type="button" onClick={goBack}>{copy.back}</button>:<span/>}
                {step<4
                  ? <button className="primary-action" type="button" onClick={goNext}>{copy.next} →</button>
                  : <button className="primary-action report-submit" type="submit" disabled={sending}>{sending?copy.sending:`${copy.send} →`}</button>}
              </div>
            </>}
          </form>

          <aside className="portal-card report-history report-history--wizard">
            <div className="portal-card__head"><div><h3>{copy.history}</h3></div></div>
            <div className="report-history-list">
              {items.length?items.slice(0,5).map(item=><button key={item.ref} type="button" onClick={()=>navigate(`/citizen/requests/${encodeURIComponent(item.ref)}`)}>
                <i aria-hidden="true">!</i>
                <div>
                  <strong>{item.reportType||item.title}</strong>
                  <span>{item.location?.label||"Lieu non précisé"}</span>
                  <small>{item.ref} · {item.updated}{Number(item.supportCount||0)>0?` · ♡ ${item.supportCount} soutien${Number(item.supportCount)>1?"s":""}`:""}</small>
                </div>
                <em className={`status-pill status-${String(item.status).replaceAll(" ","-").toLowerCase()}`}>{item.status}</em>
              </button>):<div className="dashboard-empty">{copy.empty}</div>}
            </div>
            {items.length>5?<button className="report-history-more" type="button" onClick={()=>navigate("/citizen/requests")}>Voir tout l’historique →</button>:null}
          </aside>
        </section>
      </main>
    </div>
  </div>;
}

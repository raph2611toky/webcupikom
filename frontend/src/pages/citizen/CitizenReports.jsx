import { useEffect, useMemo, useRef, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { createCitizenRequest, getCitizenRequests } from "../../api/requests.js";
import { REPORT_TYPES } from "../../constants/requestOptions.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import { getApiErrorMessage } from "../../api/auth.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

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
    locationRequired:"Indiquez où se trouve le problème avant l’envoi."
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
    locationRequired:"Enter where the problem is before sending."
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
    locationRequired:"Lazao ny toerana misy ny olana alohan'ny handefasana."
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
  return REPORT_LABELS[locale]?.[item.label] || item.label;
}

export default function CitizenReports(){
  const {user}=useAuth();
  const [locale]=useLocale();
  const copy=COPY[locale]||COPY.fr;
  const [reportType,setReportType]=useState(REPORT_TYPES[0].value);
  const [subject,setSubject]=useState("");
  const [message,setMessage]=useState("");
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
  const fileRef=useRef(null);

  const selected=useMemo(
    ()=>REPORT_TYPES.find(item=>item.value===reportType)||REPORT_TYPES[0],
    [reportType]
  );

  async function refresh(){
    try{
      const rows=await getCitizenRequests();
      setItems(rows.filter(row=>row.requestType==="signalement"));
    }catch{}
  }

  useEffect(()=>{refresh()},[]);

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
      const request=await createCitizenRequest({
        source:"citizen-report",
        type:"signalement",
        reportType:selected.label,
        category:selected.category,
        service:selected.service,
        subject:subject.trim()||selected.label,
        message:message.trim(),
        priority:priority==="danger"?"urgent":priority==="important"?"high":"normal",
        location:{
          label,
          ...(coordinates||{}),
        },
        attachments:file?[file]:[],
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
  }

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow={copy.eyebrow} title={copy.title}/>
      <main className="portal-content report-page">
        <section className="report-intro">
          <div>
            <span className="section-label">F25 · F26</span>
            <h2>{copy.introTitle}</h2>
            <p>{copy.intro}</p>
          </div>
          <i aria-hidden="true">!</i>
        </section>

        <section className="report-layout">
          <form className="portal-card report-form" onSubmit={submit}>
            {created ? <div className="report-success" role="status" aria-live="polite">
              <i aria-hidden="true">✓</i>
              <span className="section-label">{copy.success}</span>
              <h2>{created.reference}</h2>
              <p>{copy.successText}</p>
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
              <section className="report-step">
                <div className="report-step__head"><i>1</i><div><b>{copy.type}</b><span>{helperReport(selected,locale)}</span></div></div>
                <div className="report-type-grid">
                  {REPORT_TYPES.map(item=><button
                    type="button"
                    key={item.value}
                    className={reportType===item.value?"is-active":""}
                    aria-pressed={reportType===item.value}
                    onClick={()=>setReportType(item.value)}
                  >
                    <i aria-hidden="true">{item.icon}</i>
                    <div><b>{labelReport(item,locale)}</b><span>{helperReport(item,locale)}</span></div>
                  </button>)}
                </div>
              </section>

              <section className="report-step">
                <div className="report-step__head"><i>2</i><div><b>{copy.where}</b><span>{copy.locationRequired}</span></div></div>
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
              </section>

              <section className="report-step">
                <div className="report-step__head"><i>3</i><div><b>{copy.describe}</b><span>{selected.label}</span></div></div>
                <div className="report-description-grid">
                  <label><span>{copy.subject}</span><input value={subject} onChange={e=>setSubject(e.target.value)} placeholder={copy.subjectPh}/></label>
                  <label><span>{copy.details}</span><textarea rows="5" required value={message} onChange={e=>setMessage(e.target.value)} placeholder={copy.detailsPh}/></label>
                </div>

                <div className="report-priority">
                  <span>{copy.priority}</span>
                  <div>
                    {[["normal",copy.normal],["important",copy.important],["danger",copy.danger]].map(([value,label])=><button type="button" key={value} className={priority===value?"is-active":""} aria-pressed={priority===value} onClick={()=>setPriority(value)}>{label}</button>)}
                  </div>
                </div>

                <div className="report-file">
                  <div><b>{copy.photo}</b><span>{copy.photoHelp}</span></div>
                  <input ref={fileRef} hidden type="file" accept="image/*,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/>
                  <button type="button" className="secondary-action" onClick={()=>fileRef.current?.click()}>{file?`✓ ${file.name}`:"+ Ajouter"}</button>
                </div>
              </section>

              <section className="report-step report-review">
                <div className="report-step__head"><i>4</i><div><b>{copy.summary}</b><span>{copy.service}: {selected.service}</span></div></div>
                <div className="report-review-grid">
                  <div><span>{copy.type}</span><b>{labelReport(selected,locale)}</b></div>
                  <div><span>{copy.place}</span><b>{[sector,location].filter(Boolean).join(" · ")||copy.positionReady}</b></div>
                  <div><span>{copy.service}</span><b>{selected.service}</b></div>
                  <div><span>{copy.priority}</span><b>{priority==="danger"?copy.danger:priority==="important"?copy.important:copy.normal}</b></div>
                </div>
                {error?<div className="error-card" role="alert">{error}</div>:null}
                <button className="primary-action report-submit" type="submit" disabled={sending}>{sending?copy.sending:`${copy.send} →`}</button>
              </section>
            </>}
          </form>

          <aside className="portal-card report-history">
            <div className="portal-card__head"><div><span className="section-label">{copy.history}</span><h3>{copy.history}</h3></div></div>
            <div className="report-history-list">
              {items.length?items.map(item=><button key={item.ref} type="button" onClick={()=>navigate(`/citizen/requests/${encodeURIComponent(item.ref)}`)}>
                <i aria-hidden="true">!</i>
                <div>
                  <strong>{item.reportType||item.title}</strong>
                  <span>{item.location?.label||"Lieu non précisé"}</span>
                  <small>{item.ref} · {item.updated}</small>
                </div>
                <em className={`status-pill status-${String(item.status).replaceAll(" ","-").toLowerCase()}`}>{item.status}</em>
              </button>):<div className="dashboard-empty">{copy.empty}</div>}
            </div>
          </aside>
        </section>
      </main>
    </div>
  </div>;
}

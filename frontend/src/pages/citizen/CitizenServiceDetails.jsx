import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { ServiceAvailabilityBadge, ServiceAvailabilityNotice } from "../../components/ui/ServiceAvailability.jsx";
import { getService, getServiceFeedbackState, saveServiceFeedback } from "../../api/services.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";

const COPY = {
  fr: {
    eyebrow:"Services municipaux",back:"Retour aux services",request:"Faire une demande",actions:"Démarches disponibles",documents:"Documents requis",hours:"Horaires",contact:"Contact",address:"Adresse",none:"Aucune information disponible.",unavailableAction:"Démarche indisponible",availability:"État du service",
    feedbackLabel:"Votre expérience", feedbackTitle:"Donnez votre avis sur ce service", feedbackIntro:"Après une utilisation vérifiée du service, vous pouvez laisser une note et un commentaire.", loadingFeedback:"Vérification de votre éligibilité…", rating:"Note", comment:"Commentaire facultatif", commentPlaceholder:"Décrivez brièvement votre expérience…", send:"Envoyer mon avis", update:"Mettre à jour mon avis", saving:"Enregistrement…", existing:"Votre avis est enregistré", verified:"Usage vérifié", notEligible:"Avis non disponible", source:"Usage associé", chooseSource:"Choisir l’utilisation concernée", noSource:"Le backend vérifiera automatiquement votre utilisation.", retry:"Réessayer", success:"Votre contribution a bien été prise en compte.", editHint:"Vous pouvez modifier votre note ou votre commentaire à tout moment si le backend vous y autorise.",
  },
  en: {
    eyebrow:"City services",back:"Back to services",request:"Start a request",actions:"Available procedures",documents:"Required documents",hours:"Opening hours",contact:"Contact",address:"Address",none:"No information available.",unavailableAction:"Procedure unavailable",availability:"Service status",
    feedbackLabel:"Your experience", feedbackTitle:"Rate this service", feedbackIntro:"After verified use of the service, you can leave a rating and a comment.", loadingFeedback:"Checking your eligibility…", rating:"Rating", comment:"Optional comment", commentPlaceholder:"Briefly describe your experience…", send:"Send my review", update:"Update my review", saving:"Saving…", existing:"Your review is saved", verified:"Verified use", notEligible:"Review unavailable", source:"Related use", chooseSource:"Choose the related use", noSource:"The backend will verify your use automatically.", retry:"Retry", success:"Your contribution has been recorded.", editHint:"You can update your rating or comment whenever the backend allows it.",
  },
  mg: {
    eyebrow:"Sampan-draharahan'ny tanàna",back:"Hiverina amin'ny sampan-draharaha",request:"Hanao fangatahana",actions:"Dingana azo atao",documents:"Taratasy ilaina",hours:"Ora fiasana",contact:"Fifandraisana",address:"Adiresy",none:"Tsy misy vaovao.",unavailableAction:"Tsy azo atao izao",availability:"Satan'ny serivisy",
    feedbackLabel:"Ny traikefanao", feedbackTitle:"Omeo naoty ity serivisy ity", feedbackIntro:"Rehefa voamarina fa nampiasa ilay serivisy ianao dia afaka manome naoty sy hevitra.", loadingFeedback:"Hamarininay ny fahafahanao manome hevitra…", rating:"Naoty", comment:"Hevitra (tsy voatery)", commentPlaceholder:"Lazao fohy ny traikefanao…", send:"Alefa ny hevitro", update:"Hanova ny hevitro", saving:"Tehirizina…", existing:"Voatahiry ny hevitro", verified:"Fampiasana voamarina", notEligible:"Tsy afaka manome hevitra", source:"Fampiasana mifandraika", chooseSource:"Safidio ny fampiasana", noSource:"Ny backend no hanamarina ho azy ny fampiasanao.", retry:"Andramo indray", success:"Voaray tsara ny fandraisanao anjara.", editHint:"Afaka manova ny naoty na ny hevitrao ianao raha eken'ny backend izany.",
  },
};

function sourceInfo(source = {}, index = 0) {
  const requestReference = source.request_reference || source.requestReference || source.source_request_reference || "";
  const appointmentReference = source.appointment_reference || source.appointmentReference || source.source_appointment_reference || "";
  const kind = appointmentReference ? "appointment" : "request";
  const reference = appointmentReference || requestReference || source.reference || "";
  const label = source.label || source.title || source.name || (kind === "appointment" ? "Rendez-vous" : "Demande");
  return { id: `${kind}:${reference || index}`, kind, reference, label: reference ? `${label} · ${reference}` : label };
}

function FeedbackPanel({ slug, copy }) {
  const [state, setState] = useState(undefined);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sources = useMemo(() => (state?.eligibleSources || []).map(sourceInfo), [state]);

  const load = async () => {
    setError("");
    setState(undefined);
    try {
      const next = await getServiceFeedbackState(slug);
      setState(next);
      setRating(Number(next.feedback?.rating || 0));
      setComment(next.feedback?.comment || "");
      const feedbackSource = next.feedback?.source_appointment_reference
        ? `appointment:${next.feedback.source_appointment_reference}`
        : next.feedback?.source_request_reference
          ? `request:${next.feedback.source_request_reference}`
          : "";
      setSelectedSource(feedbackSource);
    } catch (err) {
      setState(null);
      setError(getApiErrorMessage(err, "Impossible de vérifier votre droit à laisser un avis."));
    }
  };

  useEffect(() => { load(); }, [slug]);

  async function submit(event) {
    event.preventDefault();
    if (!rating || saving) return;
    setSaving(true); setError(""); setNotice("");
    const source = sources.find((item) => item.id === selectedSource);
    try {
      const saved = await saveServiceFeedback(slug, {
        rating,
        comment,
        requestReference: source?.kind === "request" ? source.reference : "",
        appointmentReference: source?.kind === "appointment" ? source.reference : "",
      }, { update: Boolean(state?.canUpdate || state?.feedback) });
      setNotice(saved?.confirmation || copy.success);
      const refreshed = await getServiceFeedbackState(slug);
      setState(refreshed);
      setRating(Number(refreshed.feedback?.rating || saved?.rating || rating));
      setComment(refreshed.feedback?.comment ?? saved?.comment ?? comment);
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible d’enregistrer votre avis."));
    } finally { setSaving(false); }
  }

  return <section className="portal-card svc-feedback" aria-labelledby="service-feedback-title">
    <div className="svc-feedback__head">
      <div><span className="section-label">{copy.feedbackLabel}</span><h3 id="service-feedback-title">{copy.feedbackTitle}</h3><p>{copy.feedbackIntro}</p></div>
      {state?.feedback?.verified_usage ? <span className="svc-feedback__verified">✓ {copy.verified}</span> : null}
    </div>

    {state === undefined ? <div className="svc-feedback__state" role="status">{copy.loadingFeedback}</div> : null}
    {state === null ? <div className="svc-feedback__state svc-feedback__state--error" role="alert"><span>{error}</span><button type="button" className="secondary-action" onClick={load}>{copy.retry}</button></div> : null}

    {state && !state.eligible ? <div className="svc-feedback__state"><strong>{copy.notEligible}</strong><span>{state.eligibilityReason || copy.noSource}</span></div> : null}

    {state?.eligible ? <form className="svc-feedback__form" onSubmit={submit}>
      {state.feedback ? <div className="svc-feedback__receipt" role="status"><strong>✓ {copy.existing}</strong>{state.feedback.reference ? <span>Réf. {state.feedback.reference}</span> : null}<small>{copy.editHint}</small></div> : null}
      {notice ? <div className="success-inline" role="status">✓ {notice}</div> : null}
      {error ? <div className="error-card" role="alert">{error}</div> : null}

      <fieldset className="svc-feedback__rating"><legend>{copy.rating}</legend><div role="radiogroup" aria-label={copy.rating}>{[1,2,3,4,5].map(value => <button key={value} type="button" className={value <= rating ? "is-active" : ""} role="radio" aria-checked={rating === value} aria-label={`${value} / 5`} onClick={() => setRating(value)}>★</button>)}</div><output aria-live="polite">{rating ? `${rating}/5` : "—"}</output></fieldset>

      {sources.length ? <label className="svc-feedback__field"><span>{copy.source}</span><select value={selectedSource} onChange={e => setSelectedSource(e.target.value)}><option value="">{copy.chooseSource}</option>{sources.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label> : <p className="svc-feedback__source-note">{copy.noSource}</p>}

      <label className="svc-feedback__field"><span>{copy.comment}</span><textarea rows="4" maxLength="1200" value={comment} onChange={e=>setComment(e.target.value)} placeholder={copy.commentPlaceholder}/></label>
      <div className="svc-feedback__actions"><button className="primary-action" type="submit" disabled={!rating || saving || (!state.canCreate && !state.canUpdate)}>{saving ? copy.saving : (state.canUpdate || state.feedback ? copy.update : copy.send)}</button></div>
    </form> : null}
  </section>;
}

export default function CitizenServiceDetails({ params }) {
  const [locale] = useLocale();
  const copy = COPY[locale] || COPY.fr;
  const [service,setService]=useState(undefined);

  useEffect(()=>{
    let active=true;
    setService(undefined);
    getService(params.slug,{force:true}).then(data=>active&&setService(data)).catch(()=>active&&setService(null));
    return()=>{active=false};
  },[params.slug,locale]);

  if(service===undefined) return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow={copy.eyebrow} title="…"/><main className="portal-content"><div className="loading-card">Chargement…</div></main></div></div>;
  if(!service) return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow={copy.eyebrow} title={copy.eyebrow}/><main className="portal-content"><section className="portal-card portal-empty-centered"><h2>{copy.none}</h2><button className="primary-action" onClick={()=>navigate("/citizen/services")}>{copy.back}</button></section></main></div></div>;

  const available=service.isAvailable!==false;
  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow={copy.eyebrow} title={service.name}/>
    <main className="portal-content portal-detail-page service-detail-with-availability">
      <button className="back-link" onClick={()=>navigate("/citizen/services")}>← {copy.back}</button>

      <section className="service-portal-hero service-portal-hero--availability">
        <div className="service-portal-hero__icon" aria-hidden="true">{service.icon}</div>
        <div className="service-portal-hero__copy"><div className="service-detail-heading-line"><span>{service.category}</span><ServiceAvailabilityBadge service={service}/></div><h2>{service.name}</h2><p>{service.description || service.shortDescription}</p></div>
        <button className={`primary-action service-portal-hero__cta ${!available?"is-disabled":""}`} disabled={!available} aria-disabled={!available} onClick={()=>available&&navigate(`/citizen/requests?new=1&subject=${encodeURIComponent(service.name)}`)}>{available?copy.request:copy.unavailableAction}</button>
      </section>

      <ServiceAvailabilityNotice service={service}/>

      <section className="portal-detail-grid">
        <article className="portal-card"><span className="section-label">{copy.actions}</span><div className="portal-action-list">{(service.actions||[]).length ? (service.actions||[]).map((item,index)=><div key={`${item}-${index}`}><i>{String(index+1).padStart(2,"0")}</i><span>{String(item)}</span></div>) : <p className="detail-copy">{copy.none}</p>}</div></article>
        <article className="portal-card"><span className="section-label">{copy.documents}</span><ul className="portal-document-list">{(service.requiredDocuments||[]).length ? (service.requiredDocuments||[]).map((item,index)=><li key={`${item}-${index}`}>{String(item)}</li>) : <li>{copy.none}</li>}</ul></article>
        <article className="portal-card"><span className="section-label">{copy.hours}</span><h3>{service.openingHours || "—"}</h3><div className="portal-contact-block"><div><span>{copy.contact}</span><b>{service.phone || "—"}</b><small>{service.email || ""}</small></div><div><span>{copy.address}</span><b>{service.address || "—"}</b></div></div></article>
      </section>

      <FeedbackPanel slug={service.slug || params.slug} copy={copy}/>
    </main>
  </div></div>;
}

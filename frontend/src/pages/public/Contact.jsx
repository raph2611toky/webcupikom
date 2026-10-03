import { useEffect, useMemo, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { createCitizenRequest } from "../../api/requests.js";
import { sendContactMessage } from "../../api/contact.js";
import { getServices } from "../../api/services.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { CATEGORY_SERVICE, REQUEST_CATEGORIES, REQUEST_TYPES } from "../../constants/requestOptions.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

const initialForm = {
  type: "question",
  category: "Administration",
  name: "",
  email: "",
  subject: "",
  message: "",
  location: "",
};

function findService(services, category) {
  const target = (CATEGORY_SERVICE[category] || category || "").toLowerCase();
  const exact = services.find((service) =>
    String(service.name || "").toLowerCase().includes(target) ||
    target.includes(String(service.name || "").toLowerCase()) ||
    String(service.category || "").toLowerCase().includes(target)
  );
  if (exact) return exact;
  return services.find((service) => String(service.slug || "").toLowerCase() === "administration")
    || services.find((service) => String(service.name || "").toLowerCase().includes("administr"))
    || null;
}

export default function Contact() {
  const { user, isAuthenticated } = useAuth();
  const isCitizen = isAuthenticated && user?.role === "citizen";
  const displayName = user?.display_name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim();

  const [services,setServices]=useState([]);
  const [form,setForm]=useState(()=>({
    ...initialForm,
    name:isCitizen?displayName:"",
    email:isCitizen?user?.email||"":"",
  }));
  const [showExtras,setShowExtras]=useState(false);
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(null);
  const [error,setError]=useState("");

  useEffect(()=>{
    getServices().then(setServices).catch(()=>setServices([]));
  },[]);

  useEffect(()=>{
    if(isCitizen) setForm(current=>({...current,name:displayName,email:user?.email||""}));
  },[isCitizen,displayName,user?.email]);

  const service = useMemo(()=>findService(services,form.category),[services,form.category]);

  function patch(key,value){setForm(current=>({...current,[key]:value}))}

  async function submit(event){
    event.preventDefault();
    if(!service){
      setError("Aucun service municipal n’est disponible.");
      return;
    }

    setSending(true);
    setError("");
    try{
      const locationLine=form.location.trim()?`\n\nLocalisation : ${form.location.trim()}`:"";
      if(isCitizen){
        const request=await createCitizenRequest({
          service:Number(service.id),
          title:form.subject.trim(),
          description:`${form.message.trim()}${locationLine}\n\nType : ${form.type} · Catégorie : ${form.category}`,
          priority:form.type==="assistance"?"high":"normal",
        });
        setSent({
          reference:request.reference,
          service:request.service,
          status:request.status,
          kind:"request",
        });
      }else{
        const result=await sendContactMessage({
          name:form.name.trim(),
          email:form.email.trim(),
          service:Number(service.id),
          subject:form.subject.trim(),
          message:`${form.message.trim()}${locationLine}\n\nType : ${form.type} · Catégorie : ${form.category}`,
        });
        const receipt=result?.request || result;
        setSent({
          reference:receipt?.reference || "Message transmis",
          service:service.name,
          status:"Reçu",
          kind:"contact",
        });
      }
    }catch(err){
      setError(getApiErrorMessage(err,"Impossible d’envoyer votre message."));
    }finally{
      setSending(false);
    }
  }

  function reset(){
    setSent(null);
    setShowExtras(false);
    setError("");
    setForm({
      ...initialForm,
      name:isCitizen?displayName:"",
      email:isCitizen?user?.email||"":"",
    });
  }

  return <div className="public-page public-page--contact public-page--smart-request">
    <PublicHeader/>
    <main>
      <section className="public-hero public-hero--compact smart-request-hero smart-request-hero--simple">
        <span className="public-kicker">Aide & contact</span>
        <h1>Comment pouvons-nous <em>vous aider ?</em></h1>
        <p>Choisissez votre besoin, décrivez-le simplement et envoyez votre demande au bon service municipal.</p>
      </section>

      <section className="public-content smart-request-layout smart-request-layout--single">
        <div className="contact-form-panel smart-request-panel smart-request-panel--single">
          {sent?(
            <div className="smart-request-success" role="status" aria-live="polite">
              <div className="smart-request-success__check" aria-hidden="true">✓</div>
              <div>
                <span className="section-label">Message transmis</span>
                <h2>{sent.reference}</h2>
                <p>Votre message a bien été reçu par Nova Terra et orienté vers <b>{sent.service}</b>.</p>
              </div>
              <div className="smart-request-success__status"><span>Statut</span><b>{sent.status}</b><span>Service</span><b>{sent.service}</b></div>
              <div className="smart-request-success__actions">
                {sent.kind==="request"?<button className="primary-button" onClick={()=>navigate(`/citizen/requests/${encodeURIComponent(sent.reference)}`)}>Suivre ma demande →</button>:null}
                {isCitizen&&sent.kind==="contact"?<button className="primary-button" onClick={()=>navigate("/citizen/messages")}>Mes messages →</button>:null}
                <button className="secondary-button" onClick={reset}>Nouveau message</button>
              </div>
            </div>
          ):(
            <form className="public-form smart-request-form smart-request-form--simple" onSubmit={submit}>
              <div className="smart-request-types" aria-label="Type de demande">
                {REQUEST_TYPES.map(item=><button type="button" key={item.value} className={form.type===item.value?"is-active":""} aria-pressed={form.type===item.value} onClick={()=>patch("type",item.value)}><i aria-hidden="true">{item.icon}</i><span>{item.label}</span></button>)}
              </div>

              <div className="smart-request-grid">
                {!isCitizen?<>
                  <label><span>Nom</span><input required value={form.name} onChange={e=>patch("name",e.target.value)} placeholder="Votre nom"/></label>
                  <label><span>E-mail</span><input required type="email" value={form.email} onChange={e=>patch("email",e.target.value)} placeholder="vous@exemple.com"/></label>
                </>:null}

                <label className="span-2"><span>Catégorie</span><select value={form.category} onChange={e=>patch("category",e.target.value)}>{REQUEST_CATEGORIES.map(category=><option key={category}>{category}</option>)}</select></label>
                <label className="span-2"><span>Sujet</span><input required value={form.subject} onChange={e=>patch("subject",e.target.value)} placeholder="Ex. Lampadaire en panne"/></label>
                <label className="span-2"><span>Message</span><textarea required rows="4" value={form.message} onChange={e=>patch("message",e.target.value)} placeholder="Expliquez simplement votre question ou votre problème..."/></label>
              </div>

              <button type="button" className="smart-request-extra-toggle" onClick={()=>setShowExtras(v=>!v)}>{showExtras?"− Masquer la localisation":"+ Ajouter la localisation du problème"}</button>
              {showExtras?<div className="smart-request-evidence smart-request-evidence--simple">
                <label className="span-2"><span>Localisation <em>optionnel</em></span><input value={form.location} onChange={e=>patch("location",e.target.value)} placeholder="Secteur, rue, bâtiment..."/></label>
              </div>:null}

              <div className="smart-request-submit-row">
                <div><span>Service destinataire</span><b>{service?.name||"Chargement..."}</b></div>
                <button className="primary-button" type="submit" disabled={sending||!service}>{sending?"Transmission...":"Envoyer ma demande →"}</button>
              </div>
              {error?<div className="error-card" role="alert">{error}</div>:null}
            </form>
          )}
        </div>
      </section>
    </main>
    <Footer/>
  </div>;
}

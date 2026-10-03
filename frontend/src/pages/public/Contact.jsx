import { useEffect, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { getApiErrorMessage } from "../../api/auth.js";
import { sendContactMessage } from "../../api/contact.js";
import { getServices } from "../../api/services.js";
import "../../styles/public-pages.css";

export default function Contact(){
  const [services,setServices]=useState([]),[receipt,setReceipt]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
  useEffect(()=>{getServices().then(setServices).catch(()=>setServices([]))},[]);
  async function submit(e){
    e.preventDefault();setLoading(true);setError("");
    const form=new FormData(e.currentTarget);
    try{
      const data=await sendContactMessage({name:form.get("name"),email:form.get("email"),service:form.get("service")||null,subject:form.get("subject"),message:form.get("message")});
      setReceipt(data.request);
    }catch(err){setError(getApiErrorMessage(err,"Impossible d’envoyer le message."))}finally{setLoading(false)}
  }
  return <div className="public-page"><PublicHeader/><main>
    <section className="public-hero public-hero--compact"><span className="public-kicker">Contact</span><h1>Parlez à<br/><em>la ville.</em></h1><p>Une question, un besoin ou un signalement ? Envoyez votre message au bon service municipal.</p></section>
    <section className="contact-layout public-content">
      <aside className="contact-side"><span className="panel-kicker">Terra Nova</span><h2>Un point d’entrée unique.</h2><p>Votre message est transmis au service concerné et reçoit une référence pour faciliter le suivi.</p><div><strong>Centre administratif Astra</strong><span>Service municipal</span></div></aside>
      <div className="contact-form-panel">{receipt?<div className="success-card"><div>✓</div><span>Message envoyé avec succès</span><h2>Votre référence :<br/>{receipt.reference}</h2><p>Les services municipaux ont bien reçu votre demande.</p><button className="secondary-button" onClick={()=>setReceipt(null)}>Envoyer un autre message</button></div>:<form onSubmit={submit} className="public-form"><div className="form-grid"><label><span>Nom</span><input name="name" required placeholder="Votre nom"/></label><label><span>Email</span><input name="email" required type="email" placeholder="vous@exemple.com"/></label></div><label><span>Service concerné</span><select name="service" defaultValue=""><option value="">Aucun service spécifique</option>{services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label><span>Sujet</span><input name="subject" required placeholder="Objet de votre message"/></label><label><span>Message</span><textarea name="message" required rows="6" placeholder="Décrivez votre demande..."/></label>{error?<div className="error-card">{error}</div>:null}<button className="primary-button" type="submit" disabled={loading}>{loading?"Envoi…":"Envoyer le message →"}</button></form>}</div>
    </section>
  </main><Footer/></div>;
}

import { useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { services } from "../../data/services.js";
import "../../styles/public-pages.css";

export default function Contact(){
  const [sent,setSent]=useState(false);
  function submit(e){e.preventDefault();setSent(true);}
  return <div className="public-page"><PublicHeader/><main>
    <section className="public-hero public-hero--compact"><span className="public-kicker">Contact</span><h1>Parlez à<br/><em>la ville.</em></h1><p>Une question, un besoin ou un signalement ? Envoyez votre message au bon service municipal.</p></section>
    <section className="contact-layout public-content">
      <aside className="contact-side"><span className="panel-kicker">Terra Nova</span><h2>Un point d’entrée unique.</h2><p>Votre message est transmis au service concerné et reçoit une référence pour faciliter le suivi.</p><div><strong>Centre administratif Astra</strong><span>Ouvert du lundi au samedi</span></div><div><strong>+TN 100 000</strong><span>Standard municipal</span></div></aside>
      <div className="contact-form-panel">{sent?<div className="success-card"><div>✓</div><span>Message envoyé avec succès</span><h2>Votre référence :<br/>NT-C-2026-00045</h2><p>Les services municipaux ont bien reçu votre demande.</p><button className="secondary-button" onClick={()=>setSent(false)}>Envoyer un autre message</button></div>:<form onSubmit={submit} className="public-form"><div className="form-grid"><label><span>Nom</span><input required placeholder="Votre nom"/></label><label><span>Email</span><input required type="email" placeholder="vous@exemple.com"/></label></div><label><span>Service concerné</span><select required defaultValue=""><option value="" disabled>Sélectionner un service</option>{services.map(s=><option key={s.slug}>{s.name}</option>)}</select></label><label><span>Sujet</span><input required placeholder="Objet de votre message"/></label><label><span>Message</span><textarea required rows="6" placeholder="Décrivez votre demande..."/></label><button className="primary-button" type="submit">Envoyer le message →</button></form>}</div>
    </section>
  </main><Footer/></div>;
}

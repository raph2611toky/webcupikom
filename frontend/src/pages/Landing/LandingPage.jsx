import { lazy, Suspense } from "react";
import DeferredSection from "../../components/ui/DeferredSection.jsx";
import LanguageSwitcher from "../../components/ui/LanguageSwitcher.jsx";
import { useDataMode } from "../../utils/useDataMode.js";
import { useLocale } from "../../utils/i18n.js";
import "./LandingPage.css";

const Hero = lazy(() => import("../../components/Hero/Hero.jsx"));
const Features = lazy(() => import("../../components/Features/Features.jsx"));
const Mission = lazy(() => import("../../components/Mission/Mission.jsx"));
const LandingContact = lazy(() => import("../../components/LandingContact/LandingContact.jsx"));
const Footer = lazy(() => import("../../components/Footer/Footer.jsx"));

const LIGHT_COPY = {
  fr:{services:"Services",news:"Actualités",contact:"Contact",login:"Se connecter",welcome:"Bienvenue à Nova Terra",title:<>La ville évolue.<br/>Vos services restent accessibles.</>,text:"Une version allégée est utilisée pour accélérer le chargement sur cette connexion. Les informations et actions essentielles restent disponibles.",discover:"Découvrir les services",create:"Créer mon espace"},
  en:{services:"Services",news:"News",contact:"Contact",login:"Sign in",welcome:"Welcome to Nova Terra",title:<>The city evolves.<br/>Your services stay accessible.</>,text:"A lightweight version is used to load faster on this connection. Essential information and actions remain available.",discover:"Discover services",create:"Create my space"},
  mg:{services:"Sampan-draharaha",news:"Vaovao",contact:"Fifandraisana",login:"Hiditra",welcome:"Tongasoa eto Nova Terra",title:<>Mivoatra ny tanàna.<br/>Mbola mora idirana ny tolotra.</>,text:"Ampiasaina ny endrika maivana mba hanafainganana ny pejy. Mbola azo ampiasaina avokoa ny vaovao sy ny asa ilaina.",discover:"Hijery ny tolotra",create:"Hamorona ny habakako"},
};

function SectionFallback({ height = 320 }) {
  return <div className="landing-section-fallback" style={{ minHeight: height }} aria-hidden="true" />;
}


function LightHero() {
  const [locale] = useLocale();
  const copy = LIGHT_COPY[locale] || LIGHT_COPY.fr;

  return <main className="light-hero" id="home">
    <header className="light-hero__header">
      <a className="light-hero__logo" href="/">Nova<span>Terra</span></a>
      <nav aria-label="Navigation principale"><a href="/services">{copy.services}</a><a href="/news">{copy.news}</a><a href="/contact">{copy.contact}</a></nav>
      <a className="light-hero__login" href="/login">{copy.login}</a>
      <LanguageSwitcher className="light-hero__language" compact />
    </header>
    <section className="light-hero__content">
      <span>{copy.welcome}</span>
      <h1>{copy.title}</h1>
      <p>{copy.text}</p>
      <div><a href="/services">{copy.discover}</a><a href="/inscription">{copy.create}</a></div>
    </section>
  </main>;
}

function LightOverview() {
  return <section className="landing-light-overview" aria-labelledby="light-overview-title">
    <span>Mode léger</span>
    <h2 id="light-overview-title">Les services essentiels, sans médias lourds.</h2>
    <p>La présentation animée est remplacée par cette version sobre. Toutes les actions utiles restent disponibles.</p>
    <div>
      <article><strong>01</strong><h3>Accéder aux services</h3><p>Retrouvez les démarches et informations municipales utiles.</p><a href="/services">Voir les services →</a></article>
      <article><strong>02</strong><h3>Suivre la ville</h3><p>Consultez les annonces et alertes de Nova Terra sans charger d’images décoratives.</p><a href="/news">Voir les actualités →</a></article>
      <article><strong>03</strong><h3>Communiquer</h3><p>Contactez la ville, créez votre espace et suivez vos demandes.</p><a href="/contact">Contacter la ville →</a></article>
    </div>
  </section>;
}

export default function LandingPage() {
  const dataProfile = useDataMode();

  return (
    <div className="nova-landing">
      {dataProfile.reduced ? <LightHero /> : <Suspense fallback={<SectionFallback height={720} />}><Hero /></Suspense>}
      {dataProfile.reduced ? <LightOverview /> : <>
        <DeferredSection minHeight={720} rootMargin="700px 0px" label="Chargement des fonctionnalités">
          <Suspense fallback={<SectionFallback height={720} />}><Features /></Suspense>
        </DeferredSection>
        <DeferredSection minHeight={520} rootMargin="650px 0px" label="Chargement de la présentation">
          <Suspense fallback={<SectionFallback height={520} />}><Mission /></Suspense>
        </DeferredSection>
      </>}
      <DeferredSection minHeight={440} rootMargin="650px 0px" label="Chargement du formulaire de contact">
        <Suspense fallback={<SectionFallback height={440} />}><LandingContact /></Suspense>
      </DeferredSection>

      <DeferredSection minHeight={280} rootMargin="500px 0px" label="Chargement du pied de page">
        <Suspense fallback={<SectionFallback height={280} />}><Footer /></Suspense>
      </DeferredSection>
    </div>
  );
}

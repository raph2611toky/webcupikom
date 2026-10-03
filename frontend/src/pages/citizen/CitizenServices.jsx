import { useEffect, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getServices } from "../../api/services.js";
import { getLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function CitizenServices(){
  const [services,setServices]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const locale=getLocale();

  useEffect(()=>{
    getServices().then(setServices).catch(()=>setError(locale==="en"?"Unable to load services.":"Impossible de charger les services.")).finally(()=>setLoading(false));
  },[locale]);

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow={locale==="en"?"CITY":"VILLE"} title={locale==="en"?"City services":"Services municipaux"}/>
      <main className="portal-content">
        {loading?<div className="loading-card">{locale==="en"?"Loading...":"Chargement..."}</div>:null}
        {error?<div className="error-card" role="alert">{error}</div>:null}
        <section className="citizen-service-grid">
          {services.map(s=><article key={s.slug}>
            <i aria-hidden="true">{s.icon}</i><span>{s.category}</span><h2>{s.name}</h2><p>{s.shortDescription}</p>
            <button onClick={()=>navigate(`/services/${s.slug}`)}>{locale==="en"?"Open service":"Ouvrir le service"} →</button>
          </article>)}
        </section>
      </main>
    </div>
  </div>;
}

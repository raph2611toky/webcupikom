import { useEffect, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getServices } from "../../api/services.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function CitizenServices(){
  const [services,setServices]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{let mounted=true;getServices().then(data=>mounted&&setServices(data)).catch(()=>mounted&&setError("Impossible de charger les services.")).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[]);
  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow="Ville" title="Services municipaux"/><main className="portal-content">{loading?<div className="loading-card">Chargement…</div>:null}{error?<div className="error-card">{error}</div>:null}{!loading&&!error?<section className="citizen-service-grid">{services.map(s=><article key={s.slug}><i>{s.icon}</i><span>{s.category}</span><h2>{s.name}</h2><p>{s.shortDescription}</p><button onClick={()=>navigate(`/services/${s.slug}`)}>Ouvrir le service →</button></article>)}</section>:null}</main></div></div>;
}

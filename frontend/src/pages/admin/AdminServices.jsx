import { useEffect, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getServices } from "../../api/services.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";
export default function AdminServices(){
  const [services,setServices]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let mounted=true;getServices().then(data=>mounted&&setServices(data)).catch(()=>mounted&&setError("Impossible de charger les services.")).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[]);
  return <div className="portal-layout"><AdminSidebar/><div className="portal-main"><PortalTopbar eyebrow="Catalogue" title="Services municipaux"/><main className="portal-content">{loading?<div className="loading-card">Chargement…</div>:null}{error?<div className="error-card">{error}</div>:null}{!loading&&!error?<><p className="detail-copy">Lecture depuis l’API actuelle. Les endpoints d’édition administrative ne sont pas encore exposés.</p><section className="admin-service-list">{services.map(s=><article key={s.slug}><div className="service-admin-icon">{s.icon}</div><div><span>{s.category}</span><h3>{s.name}</h3><p>{s.shortDescription}</p></div><div className="admin-service-meta"><span>{s.openingHours||'—'}</span><b>Publié</b></div></article>)}</section></>:null}</main></div></div>;
}

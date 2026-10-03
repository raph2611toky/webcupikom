import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { services } from "../../data/services.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function CitizenServices(){return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow="Ville" title="Services municipaux"/><main className="portal-content"><section className="citizen-service-grid">{services.map(s=><article key={s.slug}><i>{s.icon}</i><span>{s.category}</span><h2>{s.name}</h2><p>{s.shortDescription}</p><button onClick={()=>navigate(`/services/${s.slug}`)}>Ouvrir le service →</button></article>)}</section></main></div></div>}

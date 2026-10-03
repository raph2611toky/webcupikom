import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { services } from "../../data/services.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";
export default function AdminServices(){return <div className="portal-layout"><AdminSidebar/><div className="portal-main"><PortalTopbar eyebrow="Catalogue" title="Services municipaux" actions={<button className="topbar-cta">+ Nouveau service</button>}/><main className="portal-content"><section className="admin-service-list">{services.map(s=><article key={s.slug}><div className="service-admin-icon">{s.icon}</div><div><span>{s.category}</span><h3>{s.name}</h3><p>{s.shortDescription}</p></div><div className="admin-service-meta"><span>{s.openingHours}</span><b>Publié</b></div><button>Modifier</button></article>)}</section></main></div></div>}

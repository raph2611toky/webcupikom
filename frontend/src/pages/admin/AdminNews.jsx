import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { news } from "../../data/news.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";
export default function AdminNews(){return <div className="portal-layout"><AdminSidebar/><div className="portal-main"><PortalTopbar eyebrow="Communication" title="Actualités" actions={<button className="topbar-cta">+ Nouvelle publication</button>}/><main className="portal-content"><section className="portal-card"><div className="admin-news-list">{news.map(n=><article key={n.slug}><div><span>{n.category}</span><h3>{n.title}</h3><p>{n.excerpt}</p></div><div><time>{n.date}</time><em>Publié</em><button>Modifier</button></div></article>)}</div></section></main></div></div>}

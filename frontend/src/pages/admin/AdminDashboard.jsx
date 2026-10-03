import { useEffect, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAdminDashboard } from "../../api/dashboards.js";
import { getAdminUsers } from "../../api/admin.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function AdminDashboard(){
  const [dashboard,setDashboard]=useState(null);
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let mounted=true;
    Promise.all([getAdminDashboard(),getAdminUsers()])
      .then(([d,u])=>{if(!mounted)return;setDashboard(d);setUsers(u)})
      .catch(e=>mounted&&setError(getApiErrorMessage(e,"Impossible de charger le tableau de bord.")))
      .finally(()=>mounted&&setLoading(false));
    return()=>{mounted=false};
  },[]);

  const u=dashboard?.users||{},s=dashboard?.services||{},n=dashboard?.news||{},r=dashboard?.requests||{};

  return <div className="portal-layout"><AdminSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Administration" title="Pilotage Nova Terra" actions={<button className="topbar-cta" onClick={()=>navigate("/admin/projects?new=1")}>+ Nouveau projet</button>}/>
    <main className="portal-content">
      {loading?<div className="loading-card">Chargement…</div>:null}
      {error?<div className="error-card" role="alert">{error}</div>:null}
      {!loading&&!error?<>
        <section className="metric-grid">
          <article><span>Utilisateurs</span><strong>{u.total||users.length}</strong><small>{u.agents||0} agents · {u.admins||0} admins</small></article>
          <article><span>Services</span><strong>{s.active||0}</strong><small>{s.total||0} au total</small></article>
          <article><span>Actualités</span><strong>{n.published||0}</strong><small>Publications actives</small></article>
          <article><span>Démarches</span><strong>{r.total||0}</strong><small>{(r.pending||0)+(r.in_progress||0)} actives</small></article>
        </section>

        <section className="portal-grid portal-grid--2">
          <article className="portal-card">
            <div className="portal-card__head"><div><span className="section-label">Utilisateurs</span><h3>Derniers comptes</h3></div><button onClick={()=>navigate("/admin/users")}>Gérer →</button></div>
            <div className="admin-list">{users.slice(0,5).map(user=><div key={user.id}>
              <div className="mini-avatar">{(user.display_name||user.email||"NT").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</div>
              <div><b>{user.display_name||user.email}</b><span>{user.role} · {user.email}</span></div>
              <em>{user.is_active?"Actif":"Inactif"}</em>
            </div>)}</div>
          </article>

          <article className="portal-card">
            <span className="section-label">Contenu</span><h3>Gestion rapide</h3>
            <div className="admin-shortcuts">
              <button onClick={()=>navigate("/admin/services")}><i>◇</i><div><b>Services municipaux</b><span>{s.active||0} actifs</span></div><em>→</em></button>
              <button onClick={()=>navigate("/admin/appointments")}><i>◷</i><div><b>Rendez-vous</b><span>Agenda et créneaux municipaux</span></div><em>→</em></button>
              <button onClick={()=>navigate("/admin/news")}><i>▤</i><div><b>Actualités</b><span>{n.published||0} publications</span></div><em>→</em></button>
              <button onClick={()=>navigate("/admin/projects")}><i>✦</i><div><b>Projets municipaux</b><span>Projets, participations et idées</span></div><em>→</em></button>
              <button onClick={()=>navigate("/admin/settings")}><i>⚙</i><div><b>Paramètres</b><span>Configuration plateforme</span></div><em>→</em></button>
            </div>
          </article>
        </section>

        <section className="system-banner"><div><i>●</i><div><span>Système connecté</span><h3>Les données affichées proviennent du backend Nova Terra.</h3></div></div><small>Session active</small></section>
      </>:null}
    </main>
  </div></div>;
}

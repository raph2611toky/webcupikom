import { useMemo, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { adminUsers } from "../../data/mockData.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function AdminUsers() {
  const [q,setQ]=useState("");
  const [role,setRole]=useState("Tous");
  const rows=useMemo(()=>adminUsers.filter((u)=>(role==="Tous"||u.role===role)&&(!q||`${u.name} ${u.email} ${u.id}`.toLowerCase().includes(q.toLowerCase()))),[q,role]);

  return <div className="portal-layout">
    <AdminSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow="Comptes" title="Utilisateurs" actions={<button className="topbar-cta">+ Ajouter</button>}/>
      <main className="portal-content">
        <section className="toolbar-card">
          <div className="toolbar-line">
            <label className="portal-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher un utilisateur" value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Nom, e-mail, identifiant..."/></label>
            <label><span className="sr-only">Filtrer par rôle</span><select aria-label="Filtrer par rôle" value={role} onChange={(e)=>setRole(e.target.value)}><option>Tous</option><option>Citoyen</option><option>Agent</option><option>Admin</option></select></label>
          </div>
        </section>
        <section className="portal-card">
          <div className="accessible-table-wrap">
            <table className="accessible-table">
              <caption className="sr-only">Liste des utilisateurs</caption>
              <thead><tr><th scope="col">Utilisateur</th><th scope="col">ID</th><th scope="col">Rôle</th><th scope="col">Statut</th><th scope="col">Actions</th></tr></thead>
              <tbody>{rows.map((u)=><tr key={u.id}><td><strong>{u.name}</strong><small>{u.email}</small></td><td className="mono">{u.id}</td><td>{u.role}</td><td><span className="status-pill status-actif">{u.status}</span></td><td><button type="button" className="accessible-table__action" aria-label={`Actions pour ${u.name}`}>Actions</button></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  </div>;
}

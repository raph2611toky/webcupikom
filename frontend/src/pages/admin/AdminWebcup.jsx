import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import PortalPagination from "../../components/ui/PortalPagination.jsx";
import { getWebcupFeed, getWebcupLocalRequests, getWebcupStatus } from "../../api/webcup.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const PER_PAGE = 8;

export default function AdminWebcup(){
  const [data,setData]=useState(null);
  const [status,setStatus]=useState(null);
  const [history,setHistory]=useState([]);
  const [feedPage,setFeedPage]=useState(1);
  const [historyPage,setHistoryPage]=useState(1);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  async function load(force=false){
    setLoading(true);
    setError("");
    try{
      const [feed,s,h]=await Promise.all([getWebcupFeed({force}),getWebcupStatus(),getWebcupLocalRequests()]);
      setData(feed);
      setStatus(s);
      setHistory(h);
      setFeedPage(1);
      setHistoryPage(1);
    }catch(e){
      setError(e?.response?.data?.detail||e.message||"Impossible de charger le flux.");
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{load()},[]);

  const session=data?.session||status?.session||{};
  const feedRows=data?.requests||[];
  const feedPages=Math.max(1,Math.ceil(feedRows.length/PER_PAGE));
  const historyPages=Math.max(1,Math.ceil(history.length/PER_PAGE));
  const visibleFeed=useMemo(()=>feedRows.slice((feedPage-1)*PER_PAGE,feedPage*PER_PAGE),[feedRows,feedPage]);
  const visibleHistory=useMemo(()=>history.slice((historyPage-1)*PER_PAGE,historyPage*PER_PAGE),[history,historyPage]);

  return <div className="portal-layout"><AdminSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="24H By WebCup" title="Flux Nova Terra" actions={<button className="topbar-cta" onClick={()=>load(true)}>Synchroniser</button>}/>
    <main className="portal-content">
      {loading?<div className="loading-card">Connexion au flux…</div>:error?<div className="error-card">{error}</div>:<>
        <section className="api-status"><div><i/><span>Session {session.status||"active"}</span><small>{status?.known_requests_count||history.length} demande(s) connues côté backend</small></div><strong>Vague {session.current_wave??0}</strong></section>

        <section className="portal-card">
          <div className="portal-card__head"><div><span className="section-label">Flux courant</span><h3>Demandes visibles</h3></div></div>
          <div className="api-request-list">
            {visibleFeed.map((r,i)=><article key={r.request_code||i}><div className="api-request-code">{r.request_code}</div><div><span>{r.requester_name||"Nova Terra"}</span><strong>{r.message_public}</strong></div><em>{r.difficulty||"—"}</em><b>{r.xp_available??r.xp_total??"—"} XP</b></article>)}
            {!feedRows.length?<p className="detail-copy">Aucune demande visible actuellement.</p>:null}
            {feedRows.length?<PortalPagination page={feedPage} totalPages={feedPages} totalItems={feedRows.length} perPage={PER_PAGE} onPageChange={setFeedPage} itemLabel="demande" itemLabelPlural="demandes"/>:null}
          </div>
        </section>

        <section className="portal-card">
          <div className="portal-card__head"><div><span className="section-label">Historique local</span><h3>Toutes les demandes observées</h3></div></div>
          <div className="api-request-list">
            {visibleHistory.map((r,i)=><article key={r.request_code||i}><div className="api-request-code">{r.request_code}</div><div><span>Vague {r.wave_number??0} · {r.requester_name||"Nova Terra"}</span><strong>{r.message_public}</strong></div><em>{r.is_visible?"Visible":"Historique"}</em><b>{r.xp_available??r.xp_total??0} XP</b></article>)}
            {!history.length?<p className="detail-copy">Aucun historique disponible.</p>:null}
            {history.length?<PortalPagination page={historyPage} totalPages={historyPages} totalItems={history.length} perPage={PER_PAGE} onPageChange={setHistoryPage} itemLabel="demande" itemLabelPlural="demandes"/>:null}
          </div>
        </section>
      </>}
    </main>
  </div></div>;
}

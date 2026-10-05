import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import PortalPagination from "../../components/ui/PortalPagination.jsx";
import { getWebcupFeed } from "../../api/webcup.js";

const PER_PAGE = 8;

export default function AgentApi(){
  const [data,setData]=useState(null);
  const [page,setPage]=useState(1);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  async function load(){
    setLoading(true);
    setError("");
    try{
      setData(await getWebcupFeed());
      setPage(1);
    }catch(e){
      setError(e.message);
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{load()},[]);

  const session=data?.session||{};
  const rows=data?.requests||[];
  const totalPages=Math.max(1,Math.ceil(rows.length/PER_PAGE));
  const visibleRows=useMemo(()=>rows.slice((page-1)*PER_PAGE,page*PER_PAGE),[rows,page]);

  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="24H By WebCup" title="Flux Nova Terra" actions={<button className="topbar-cta" onClick={load}>Actualiser</button>}/>
    <main className="portal-content">
      {loading?<div className="loading-card">Connexion au flux…</div>:error?<div className="error-card">{error}</div>:<>
        <section className="api-status"><div><i/><span>Session {session.status==="running"?"active":"disponible"}</span><small>Source : {data.source==="live"?"API officielle":"données de démonstration"}</small></div><strong>Vague {session.current_wave??0}</strong></section>
        <section className="metric-grid"><article><span>Vague actuelle</span><strong>{session.current_wave??0}</strong></article><article><span>Demandes visibles</span><strong>{session.visible_requests_count??rows.length}</strong></article><article><span>Prochaine vague</span><strong>{session.next_wave_number??"—"}</strong></article><article><span>Temps restant</span><strong>{session.minutes_until_next_wave??"—"}<small> min</small></strong></article></section>
        <section className="portal-card"><div className="portal-card__head"><div><span className="section-label">Demandes disponibles</span><h3>Flux actuel</h3></div></div>
          <div className="api-request-list">
            {visibleRows.map((r,i)=><article key={r.request_code||r.code||i}><div className="api-request-code">{r.request_code||r.code}</div><div><span>{r.requester_name||r.group||"Nova Terra"}</span><strong>{r.message_public||r.title}</strong></div><em>{r.difficulty||"—"}</em><b>{r.xp_available??r.xp??"—"} XP</b></article>)}
            {!rows.length?<p className="detail-copy">Aucune demande visible actuellement.</p>:null}
            {rows.length?<PortalPagination page={page} totalPages={totalPages} totalItems={rows.length} perPage={PER_PAGE} onPageChange={setPage} itemLabel="demande" itemLabelPlural="demandes"/>:null}
          </div>
        </section>
      </>}
    </main>
  </div></div>;
}

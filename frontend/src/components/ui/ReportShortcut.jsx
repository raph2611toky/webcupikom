import { useEffect, useState } from "react";
import { getCitizenRequests } from "../../api/requests.js";
import { navigate } from "../../utils/navigation.js";

export default function ReportShortcut({label="Signalements"}){
  const [count,setCount]=useState(0);
  async function refresh(){
    try{
      const rows=await getCitizenRequests({type:"report",page_size:100,ordering:"-created_at"});
      setCount(rows.filter(item=>!item.isClosed).length);
    }catch{/* Le raccourci ne doit jamais bloquer le header. */}
  }
  useEffect(()=>{
    refresh();
    const timer=window.setInterval(refresh,45000);
    const onFocus=()=>refresh();
    window.addEventListener("focus",onFocus);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",onFocus)};
  },[]);
  return <button className="portal-topbar__icon portal-report-shortcut" type="button" aria-label={count?`${label} · ${count} ouvert${count>1?"s":""}`:label} onClick={()=>navigate("/citizen/signalements")}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 21 19H3L12 3.5Z"/><path d="M12 9v4.5"/><circle cx="12" cy="16.8" r=".8"/></svg>
    {count>0?<b aria-hidden="true">{count>9?"9+":count}</b>:null}
  </button>;
}

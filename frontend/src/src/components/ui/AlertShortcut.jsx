import { useEffect, useState } from "react";
import { getAlerts } from "../../api/news.js";
import { navigate } from "../../utils/navigation.js";

export default function AlertShortcut({label="Alertes municipales"}){
  const [count,setCount]=useState(0);

  async function refresh(){
    try{
      const rows=await getAlerts({page_size:50,published:true});
      const active=rows.filter(item=>item.publication_state!=="expired"&&item.published!==false);
      setCount(active.length);
    }catch{
      setCount(0);
    }
  }

  useEffect(()=>{
    refresh();
    const timer=window.setInterval(refresh,45000);
    const onFocus=()=>refresh();
    const onNews=()=>refresh();
    window.addEventListener("focus",onFocus);
    window.addEventListener("terra-news-updated",onNews);
    return()=>{
      window.clearInterval(timer);
      window.removeEventListener("focus",onFocus);
      window.removeEventListener("terra-news-updated",onNews);
    };
  },[]);

  return <button
    className="portal-topbar__icon portal-alert-shortcut"
    type="button"
    aria-label={count?`${label} · ${count} active${count>1?"s":""}`:label}
    onClick={()=>navigate("/citizen/news?type=alert")}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5 21 19H3L12 3.5Z"/>
      <path d="M12 9v4.5"/>
      <circle cx="12" cy="16.8" r=".8"/>
    </svg>
    {count>0?<b aria-hidden="true">{count>9?"9+":count}</b>:null}
  </button>;
}

import { useEffect, useState } from "react";
import { getCitizenNotifications } from "../../api/notifications.js";
import { navigate } from "../../utils/navigation.js";

const EVENT = "nova-notifications-updated";

export default function NotificationBell({ label = "Notifications" }) {
  const [count,setCount]=useState(0);

  async function refresh(){
    try{
      const rows=await getCitizenNotifications();
      setCount(rows.filter(item=>!item.is_read).length);
    }catch{
      // The topbar must never break the portal if the notification endpoint is temporarily unavailable.
    }
  }

  useEffect(()=>{
    refresh();
    const timer=window.setInterval(refresh,30000);
    const onFocus=()=>refresh();
    const onUpdate=()=>refresh();
    window.addEventListener("focus",onFocus);
    window.addEventListener(EVENT,onUpdate);
    return()=>{
      window.clearInterval(timer);
      window.removeEventListener("focus",onFocus);
      window.removeEventListener(EVENT,onUpdate);
    };
  },[]);

  return (
    <button
      className="portal-topbar__icon portal-notification-bell"
      type="button"
      aria-label={count ? `${label} · ${count} non lue${count>1?"s":""}` : label}
      onClick={()=>navigate("/citizen/notifications")}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M10 20h4"/></svg>
      {count>0?<b aria-hidden="true">{count>9?"9+":count}</b>:null}
    </button>
  );
}

export function notifyNotificationStateChanged(){
  window.dispatchEvent(new CustomEvent(EVENT));
}

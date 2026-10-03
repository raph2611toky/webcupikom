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
      <span aria-hidden="true">⌁</span>
      {count>0?<b aria-hidden="true">{count>9?"9+":count}</b>:null}
    </button>
  );
}

export function notifyNotificationStateChanged(){
  window.dispatchEvent(new CustomEvent(EVENT));
}

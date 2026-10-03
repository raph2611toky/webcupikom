const APPOINTMENTS_KEY = "nova_terra_appointments_v1";
const BLOCKED_SLOTS_KEY = "nova_terra_appointment_blocks_v1";
const LOCAL_NOTIFICATIONS_KEY = "nova_terra_local_notifications_v1";
const UPDATE_EVENT = "nova-appointments-updated";
const NOTIFICATION_EVENT = "nova-local-notifications-updated";

const TIMES = ["09:00","10:00","11:00","14:00","15:00","16:00"];

function read(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function emit(name) {
  window.dispatchEvent(new CustomEvent(name));
}

function makeReference() {
  const year = new Date().getFullYear();
  return `RDV-${year}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
}

function toTimestamp(date, time) {
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value.getTime();
}

function localDateLabel(date, locale = "fr") {
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale === "mg" ? "mg-MG" : "fr-FR", {
      weekday:"long", day:"2-digit", month:"long", year:"numeric"
    }).format(new Date(`${date}T12:00:00`));
  } catch {
    return date;
  }
}

export function pushLocalNotification(notification) {
  const rows = read(LOCAL_NOTIFICATIONS_KEY, []);
  const next = {
    id: notification.id || `local-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    local: true,
    is_read: false,
    created_at: new Date().toISOString(),
    ...notification,
  };
  write(LOCAL_NOTIFICATIONS_KEY, [next, ...rows].slice(0,80));
  emit(NOTIFICATION_EVENT);
  return next;
}

export function getLocalNotifications() {
  return read(LOCAL_NOTIFICATIONS_KEY, []);
}

export function setLocalNotificationRead(id, isRead = true) {
  const rows = read(LOCAL_NOTIFICATIONS_KEY, []);
  const next = rows.map((row) => row.id === id ? {...row, is_read: Boolean(isRead)} : row);
  write(LOCAL_NOTIFICATIONS_KEY, next);
  emit(NOTIFICATION_EVENT);
  return next.find((row) => row.id === id) || null;
}

export function markAllLocalNotificationsRead() {
  const rows = read(LOCAL_NOTIFICATIONS_KEY, []).map((row) => ({...row,is_read:true}));
  write(LOCAL_NOTIFICATIONS_KEY, rows);
  emit(NOTIFICATION_EVENT);
}

export function getAppointments() {
  return read(APPOINTMENTS_KEY, []).sort((a,b) => {
    const ta = toTimestamp(a.date,a.time) || 0;
    const tb = toTimestamp(b.date,b.time) || 0;
    return ta - tb;
  });
}

export function getCitizenAppointments(citizenId) {
  return getAppointments().filter((item) => String(item.citizenId) === String(citizenId));
}

export function getAppointment(id) {
  return getAppointments().find((item) => String(item.id) === String(id)) || null;
}

export function getUpcomingDates(days = 8) {
  const result = [];
  const cursor = new Date();
  cursor.setHours(12,0,0,0);

  while (result.length < days) {
    cursor.setDate(cursor.getDate() + 1);
    const weekday = cursor.getDay();
    if (weekday === 0 || weekday === 6) continue;
    result.push(cursor.toISOString().slice(0,10));
  }
  return result;
}

export function getAppointmentSlots({ serviceId, date }) {
  const appointments = getAppointments();
  const blocked = read(BLOCKED_SLOTS_KEY, []);
  return TIMES.map((time) => {
    const key = `${serviceId}|${date}|${time}`;
    const appointment = appointments.find((item) =>
      String(item.serviceId) === String(serviceId) &&
      item.date === date &&
      item.time === time &&
      !["cancelled"].includes(item.status)
    );
    const isBlocked = blocked.some((item) => item.key === key);
    return {
      key,
      time,
      state: appointment ? "booked" : isBlocked ? "unavailable" : "available",
      appointmentId: appointment?.id || null,
    };
  });
}

export function toggleAppointmentSlotAvailability({ serviceId, date, time, unavailable }) {
  const key = `${serviceId}|${date}|${time}`;
  const rows = read(BLOCKED_SLOTS_KEY, []).filter((item) => item.key !== key);
  if (unavailable) rows.push({key,serviceId,date,time,createdAt:new Date().toISOString()});
  write(BLOCKED_SLOTS_KEY, rows);
  emit(UPDATE_EVENT);
}

export function createAppointment(payload) {
  const rows = getAppointments();
  const slot = getAppointmentSlots({serviceId:payload.serviceId,date:payload.date})
    .find((item) => item.time === payload.time);

  if (!slot || slot.state !== "available") {
    throw new Error("Ce créneau n’est plus disponible. Choisissez un autre horaire.");
  }

  const appointment = {
    id: makeReference(),
    citizenId: payload.citizenId,
    citizenName: payload.citizenName || "Citoyen",
    citizenEmail: payload.citizenEmail || "",
    serviceId: payload.serviceId,
    serviceName: payload.serviceName || "Service municipal",
    agentName: payload.agentName || "Agent municipal disponible",
    date: payload.date,
    time: payload.time,
    durationMinutes: 30,
    reason: payload.reason || "",
    notes: payload.notes || "",
    reminder: Boolean(payload.reminder),
    status: "confirmed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  write(APPOINTMENTS_KEY, [...rows, appointment]);
  pushLocalNotification({
    type:"appointment",
    category:"Rendez-vous",
    event_status:"Confirmé",
    title:"Rendez-vous confirmé",
    message:`${appointment.serviceName} · ${localDateLabel(appointment.date)} à ${appointment.time}`,
    appointment_id:appointment.id,
  });

  if (appointment.reminder) {
    const timestamp = toTimestamp(appointment.date, appointment.time);
    pushLocalNotification({
      type:"appointment_reminder",
      category:"Rendez-vous",
      event_status:"Rappel programmé",
      title:"Rappel de rendez-vous programmé",
      message:`Un rappel est prévu avant votre rendez-vous du ${localDateLabel(appointment.date)} à ${appointment.time}.`,
      appointment_id:appointment.id,
      scheduled_for: timestamp ? new Date(timestamp - 24*60*60*1000).toISOString() : null,
    });
  }

  emit(UPDATE_EVENT);
  return appointment;
}

export function updateAppointment(id, changes = {}) {
  const rows = getAppointments();
  let updated = null;
  const next = rows.map((item) => {
    if (String(item.id) !== String(id)) return item;
    updated = {...item,...changes,updatedAt:new Date().toISOString()};
    return updated;
  });
  if (!updated) throw new Error("Rendez-vous introuvable.");
  write(APPOINTMENTS_KEY, next);

  const statusLabels = {
    checked_in:"Arrivé / check-in",
    completed:"Terminé",
    cancelled:"Annulé",
    confirmed:"Confirmé",
  };
  if (changes.status && statusLabels[changes.status]) {
    pushLocalNotification({
      type:"appointment",
      category:"Rendez-vous",
      event_status:statusLabels[changes.status],
      title:`Rendez-vous · ${statusLabels[changes.status]}`,
      message:`${updated.serviceName} · ${localDateLabel(updated.date)} à ${updated.time}`,
      appointment_id:updated.id,
    });
  }

  emit(UPDATE_EVENT);
  return updated;
}

export function cancelAppointment(id) {
  return updateAppointment(id,{status:"cancelled"});
}


export function materializeDueAppointmentReminders() {
  const appointments = getAppointments();
  const notifications = read(LOCAL_NOTIFICATIONS_KEY, []);
  const now = Date.now();
  let changed = false;
  let next = [...notifications];

  for (const appointment of appointments) {
    if (!appointment.reminder || appointment.status !== "confirmed") continue;
    const appointmentAt = toTimestamp(appointment.date, appointment.time);
    if (!appointmentAt) continue;

    const reminderAt = appointmentAt - 24 * 60 * 60 * 1000;
    const due = now >= reminderAt && now < appointmentAt;
    const reminderId = `appointment-reminder-${appointment.id}`;
    const exists = next.some((item) => item.id === reminderId);

    if (due && !exists) {
      next.unshift({
        id: reminderId,
        local: true,
        is_read: false,
        created_at: new Date().toISOString(),
        type: "appointment_reminder_due",
        category: "Rendez-vous",
        event_status: "Rappel",
        title: "Rappel · rendez-vous à venir",
        message: `${appointment.serviceName} · ${localDateLabel(appointment.date)} à ${appointment.time}`,
        appointment_id: appointment.id,
      });
      changed = true;

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("Nova Terra · Rendez-vous", {
            body: `${appointment.serviceName} · ${localDateLabel(appointment.date)} à ${appointment.time}`,
          });
        } catch {}
      }
    }
  }

  if (changed) {
    write(LOCAL_NOTIFICATIONS_KEY, next.slice(0,80));
    emit(NOTIFICATION_EVENT);
  }

  return next;
}

export function getAppointmentStatusLabel(status) {
  return ({
    confirmed:"Confirmé",
    checked_in:"Arrivé / check-in",
    completed:"Terminé",
    cancelled:"Annulé",
  })[status] || status;
}

export function getSlotStatusLabel(state) {
  return ({
    available:"Disponible",
    booked:"Réservé",
    unavailable:"Indisponible",
  })[state] || state;
}

import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getServices } from "../../api/services.js";
import {
  cancelCitizenAppointment,
  createCitizenAppointment,
  getAppointmentStatusLabel,
  getCitizenAppointmentAgents,
  getCitizenAppointmentAvailability,
  getCitizenAppointmentCollections,
} from "../../api/appointments.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";
import "../../styles/pages/citizen-appointments-v82.css";

const COPY = {
  fr: {
    eyebrow: "Espace citoyen",
    title: "Rendez-vous",
    listSubtitle: "Consultez, gérez et prenez vos rendez-vous avec un agent municipal.",
    bookingSubtitle: "Prenez rendez-vous avec un agent municipal pour vos démarches.",
    heroTitle: "Mes rendez-vous",
    heroText: "Retrouvez tous vos rendez-vous à venir et passés. Vous pouvez en prendre un nouveau ou annuler un rendez-vous.",
    bookNow: "Prendre un rendez-vous",
    bookingPanelTitle: "Votre rendez-vous",
    stepService: "Service et agent",
    stepDate: "Date et heure",
    stepSummary: "Récapitulatif",
    service: "Service",
    agent: "Agent",
    chooseAgent: "Sélectionner un agent",
    reason: "Motif du rendez-vous",
    reasonPlaceholder: "Ex. Aide pour compléter une démarche",
    chooseDate: "Choisir une date",
    slotTitle: "Choisir un créneau de 1 heure",
    slotHelp: "Chaque créneau correspond à un rendez-vous d'une durée de 1 heure.",
    appointmentDuration: "Durée du rendez-vous",
    oneHour: "1 heure",
    askAppointment: "Demander le rendez-vous",
    cancelForm: "Annuler",
    all: "Tous",
    upcoming: "À venir",
    past: "Passés",
    cancelledTab: "Annulés",
    allDates: "Toutes les dates",
    thisMonth: "Ce mois-ci",
    futureDates: "À venir",
    pastDates: "Passés",
    search: "Rechercher un rendez-vous...",
    nextAppointment: "Prochain rendez-vous",
    calendar: "Calendrier",
    empty: "Aucun rendez-vous trouvé.",
    noSlots: "Aucun créneau libre pour cette date.",
    chooseDateFirst: "Sélectionnez d’abord une date dans le calendrier.",
    loadingSlots: "Vérification des disponibilités…",
    date: "Date",
    time: "Heure",
    status: "Statut",
    actions: "Actions",
    view: "Voir",
    dateLabel: "Date",
    timeLabel: "Heure",
    reasonLabel: "Motif",
    note: "Merci de vous présenter environ 10 minutes avant avec une pièce d'identité et les documents nécessaires.",
    available: "Disponible",
    selected: "Sélectionné",
    unavailable: "Indisponible",
    selectDateTitle: "Choisir une date",
    previous: "Mois précédent",
    next: "Mois suivant",
    weekdays: ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"],
    searchRequests: "Recherche",
    createdConfirmed: "Votre rendez-vous est bien confirmé",
    createdPending: "Votre demande de rendez-vous est enregistrée",
    createdTextConfirmed: "Le rendez-vous est confirmé.",
    createdTextPending: "La demande a été envoyée. L’agent pourra la confirmer depuis son espace.",
    leavePage: "Quitter la page",
    another: "Prendre un autre rendez-vous",
    reference: "Référence",
    cancelAsk: "Annuler ce rendez-vous ?",
    cancelled: "Rendez-vous annulé.",
    error: "Impossible d’enregistrer ce rendez-vous.",
    availabilityError: "Impossible de vérifier les disponibilités de cet agent.",
    conflict: "Cette heure vient d’être réservée. Les disponibilités ont été actualisées.",
    choose: "Choisissez un service, un agent, une date et une heure.",
  },
  en: {
    eyebrow: "Citizen space",
    title: "Appointments",
    listSubtitle: "View, manage and book appointments with a municipal agent.",
    bookingSubtitle: "Book an appointment with a municipal agent for your procedures.",
    heroTitle: "My appointments",
    heroText: "Find all your upcoming and past appointments. You can book a new one or cancel an appointment.",
    bookNow: "Book an appointment",
    bookingPanelTitle: "Your appointment",
    stepService: "Service and agent",
    stepDate: "Date and time",
    stepSummary: "Summary",
    service: "Service",
    agent: "Agent",
    chooseAgent: "Select an agent",
    reason: "Reason for appointment",
    reasonPlaceholder: "E.g. Help completing a procedure",
    chooseDate: "Choose a date",
    slotTitle: "Choose a 1-hour slot",
    slotHelp: "Each slot corresponds to a 1-hour appointment.",
    appointmentDuration: "Appointment duration",
    oneHour: "1 hour",
    askAppointment: "Request appointment",
    cancelForm: "Cancel",
    all: "All",
    upcoming: "Upcoming",
    past: "Past",
    cancelledTab: "Cancelled",
    allDates: "All dates",
    thisMonth: "This month",
    futureDates: "Upcoming",
    pastDates: "Past",
    search: "Search an appointment...",
    nextAppointment: "Next appointment",
    calendar: "Calendar",
    empty: "No appointment found.",
    noSlots: "No free slot for this date.",
    chooseDateFirst: "Select a date in the calendar first.",
    loadingSlots: "Checking availability…",
    date: "Date",
    time: "Time",
    status: "Status",
    actions: "Actions",
    view: "View",
    dateLabel: "Date",
    timeLabel: "Time",
    reasonLabel: "Reason",
    note: "Please arrive about 10 minutes early with an ID and the required documents.",
    available: "Available",
    selected: "Selected",
    unavailable: "Unavailable",
    selectDateTitle: "Choose a date",
    previous: "Previous month",
    next: "Next month",
    weekdays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    searchRequests: "Search",
    createdConfirmed: "Your appointment is confirmed",
    createdPending: "Your appointment request is recorded",
    createdTextConfirmed: "The appointment is confirmed.",
    createdTextPending: "The request has been sent. The agent can confirm it from their workspace.",
    leavePage: "Leave this page",
    another: "Book another appointment",
    reference: "Reference",
    cancelAsk: "Cancel this appointment?",
    cancelled: "Appointment cancelled.",
    error: "Unable to save this appointment.",
    availabilityError: "Unable to check this agent's availability.",
    conflict: "This slot was just booked. Availability has been refreshed.",
    choose: "Choose a service, an agent, a date and a time.",
  },
  mg: {
    eyebrow: "Sehatra olom-pirenena",
    title: "Fotoana",
    listSubtitle: "Jereo, tantano ary raiso ny fotoananao amin'ny mpiasan'ny kaominina.",
    bookingSubtitle: "Makà fotoana amin'ny agent monisipaly ho an'ny antontan-taratasinao.",
    heroTitle: "Ny fotoanako",
    heroText: "Jereo ny fotoana ho avy sy lasa. Afaka maka fotoana vaovao na manafoana fotoana ianao.",
    bookNow: "Haka fotoana",
    bookingPanelTitle: "Ny fotoananao",
    stepService: "Sampan-draharaha sy agent",
    stepDate: "Daty sy ora",
    stepSummary: "Famintinana",
    service: "Sampan-draharaha",
    agent: "Agent",
    chooseAgent: "Safidio ny agent",
    reason: "Antony",
    reasonPlaceholder: "Ohatra: fanampiana amin'ny fangatahana",
    chooseDate: "Safidio ny daty",
    slotTitle: "Safidio ny ora 1 ora",
    slotHelp: "Ny slot tsirairay dia fotoana maharitra 1 ora.",
    appointmentDuration: "Halavan'ny fotoana",
    oneHour: "1 ora",
    askAppointment: "Hangataka fotoana",
    cancelForm: "Hanafoana",
    all: "Rehetra",
    upcoming: "Ho avy",
    past: "Lasa",
    cancelledTab: "Nofoanana",
    allDates: "Daty rehetra",
    thisMonth: "Ity volana ity",
    futureDates: "Ho avy",
    pastDates: "Lasa",
    search: "Hitady fotoana...",
    nextAppointment: "Fotoana manaraka",
    calendar: "Kalandrie",
    empty: "Tsy misy fotoana.",
    noSlots: "Tsy misy slot malalaka amin'io daty io.",
    chooseDateFirst: "Safidio aloha ny daty.",
    loadingSlots: "Manamarina ny fahafahana…",
    date: "Daty",
    time: "Ora",
    status: "Sata",
    actions: "Hetsika",
    view: "Jereo",
    dateLabel: "Daty",
    timeLabel: "Ora",
    reasonLabel: "Antony",
    note: "Tongava 10 minitra mialoha miaraka amin'ny kara-panondro sy ny antontan-taratasy ilaina.",
    available: "Misy",
    selected: "Voafidy",
    unavailable: "Tsy misy",
    selectDateTitle: "Safidio ny daty",
    previous: "Volana teo aloha",
    next: "Volana manaraka",
    weekdays: ["AL", "AT", "AR", "AK", "ZO", "AS", "AD"],
    searchRequests: "Fikarohana",
    createdConfirmed: "Voamarina ny fotoana",
    createdPending: "Voaray ny fangatahana fotoana",
    createdTextConfirmed: "Voamarina ny fotoana.",
    createdTextPending: "Nalefa ny fangatahana ary afaka manamarina azy ny agent.",
    leavePage: "Hiala",
    another: "Haka fotoana hafa",
    reference: "Laharana",
    cancelAsk: "Hanafoana ity fotoana ity?",
    cancelled: "Nofoanana ny fotoana.",
    error: "Tsy afaka mitahiry ny fotoana.",
    availabilityError: "Tsy afaka manamarina ny fahafahana.",
    conflict: "Efa nisy naka io ora io. Nohavaozina ny fahafahana.",
    choose: "Safidio ny sampan-draharaha, agent, daty ary ora.",
  },
};

function pad(value) { return String(value).padStart(2, "0"); }
function dateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function parseDate(key) { const [y, m, d] = String(key).split("-").map(Number); return new Date(y, m - 1, d, 12, 0, 0, 0); }
function startOfDay(date = new Date()) { return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0); }
function sameMonth(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }
function buildMonthDays(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12);
  const mondayIndex = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((mondayIndex + daysInMonth) / 7) * 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayIndex);
  return Array.from({ length: cellCount }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}
function monthLabel(date, locale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale === "mg" ? "mg-MG" : "fr-FR", { month: "long", year: "numeric" }).format(date);
}
function longDate(date, locale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale === "mg" ? "mg-MG" : "fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(date);
}
function shortDate(date, locale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale === "mg" ? "mg-MG" : "fr-FR", { day: "2-digit", month: "short" }).format(date);
}
function timeRange(item) {
  if (!item) return "—";
  if (item.startTime && item.endTime) return `${item.startTime} – ${item.endTime}`;
  return item.startTime || item.time || "—";
}
function titleCase(value = "") {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}
function appointmentCategory(item) {
  const status = String(item?.status || "").toLowerCase();
  const cancelled = new Set(["cancelled", "declined", "rejected"]);
  const closed = new Set(["completed", "no_show"]);
  const start = item?.startsAt ? new Date(item.startsAt).getTime() : 0;
  const now = Date.now();
  if (cancelled.has(status)) return "cancelled";
  if (closed.has(status) || (Number.isFinite(start) && start && start < now)) return "past";
  return "upcoming";
}
function serviceTheme(name = "") {
  const value = String(name).toLowerCase();
  if (/(admin|document|civil)/.test(value)) return "administration";
  if (/(energie|énergie|electric|power)/.test(value)) return "energy";
  if (/(transport|bus|mobil)/.test(value)) return "transport";
  if (/(sant|health|medical)/.test(value)) return "health";
  if (/(secur|sécur|safe)/.test(value)) return "safety";
  if (/(logement|housing|home)/.test(value)) return "housing";
  return "default";
}

export default function CitizenAppointments() {
  const { user } = useAuth();
  const [locale] = useLocale();
  const copy = COPY[locale] || COPY.fr;
  const today = useMemo(() => startOfDay(new Date()), []);
  const [services, setServices] = useState([]);
  const [agents, setAgents] = useState([]);
  const [serviceId, setServiceId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1, 12));
  const [date, setDate] = useState("");
  const [availability, setAvailability] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [slotId, setSlotId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [contactPhone, setContactPhone] = useState(user?.phone_number || "");
  const [accessibilityNeeds, setAccessibilityNeeds] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState(locale);
  const [upcoming, setUpcoming] = useState([]);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmedAppointment, setConfirmedAppointment] = useState(null);
  const [pageMode, setPageMode] = useState("list");
  const [listFilter, setListFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const selectedService = useMemo(() => services.find((item) => String(item.id) === String(serviceId)) || null, [services, serviceId]);
  const selectedAgent = useMemo(() => agents.find((item) => String(item.id) === String(agentId)) || null, [agents, agentId]);
  const monthDays = useMemo(() => buildMonthDays(month), [month]);
  const selectedSlot = availability.find((slot) => String(slot.id) === String(slotId)) || null;
  const selectedDate = date ? parseDate(date) : null;
  const slotDuration = selectedSlot?.durationMinutes || availability[0]?.durationMinutes || 60;
  const allAppointments = useMemo(() => [...upcoming, ...history].sort((a, b) => String(b.startsAt || "").localeCompare(String(a.startsAt || ""))), [upcoming, history]);
  const nextAppointment = useMemo(() => [...upcoming].sort((a, b) => String(a.startsAt || "").localeCompare(String(b.startsAt || "")))[0] || null, [upcoming]);
  const appointmentDates = useMemo(() => {
    const map = new Map();
    allAppointments.forEach((item) => {
      if (!item?.date) return;
      map.set(item.date, appointmentCategory(item));
    });
    return map;
  }, [allAppointments]);
  const listCounts = useMemo(() => ({
    all: allAppointments.length,
    upcoming: allAppointments.filter((item) => appointmentCategory(item) === "upcoming").length,
    past: allAppointments.filter((item) => appointmentCategory(item) === "past").length,
    cancelled: allAppointments.filter((item) => appointmentCategory(item) === "cancelled").length,
  }), [allAppointments]);

  async function loadLists() {
    try {
      const collections = await getCitizenAppointmentCollections();
      setUpcoming(collections.upcoming);
      setHistory(collections.history);
    } catch (err) {
      setError(getApiErrorMessage(err, copy.error));
    }
  }

  async function loadAvailability(nextAgent = agentId, nextDate = date) {
    if (!nextAgent || !nextDate) {
      setAvailability([]);
      return;
    }
    setAvailabilityLoading(true);
    setError("");
    try {
      const agent = agents.find((item) => String(item.id) === String(nextAgent));
      const service = services.find((item) => String(item.id) === String(serviceId));
      const rows = await getCitizenAppointmentAvailability({
        agent: nextAgent,
        date: nextDate,
        agentName: agent?.name || "",
        openingHours: service?.openingHours || "",
        durationMinutes: 60,
      });
      setAvailability(rows);
    } catch (err) {
      setAvailability([]);
      setError(getApiErrorMessage(err, copy.availabilityError));
    } finally {
      setAvailabilityLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    Promise.all([getServices(), getCitizenAppointmentAgents()])
      .then(([serviceRows, agentRows]) => {
        if (!mounted) return;
        const bookableServices = serviceRows.filter((service) => service.isAvailable !== false);
        setServices(bookableServices);
        setAgents(agentRows);
        if (bookableServices[0]) setServiceId(String(bookableServices[0].id));
        if (agentRows[0]) setAgentId(String(agentRows[0].id));
      })
      .catch((err) => mounted && setError(getApiErrorMessage(err, copy.error)));
    loadLists();
    return () => { mounted = false; };
  }, [locale]);

  useEffect(() => { setContactPhone(user?.phone_number || ""); }, [user?.phone_number]);
  useEffect(() => { setPreferredLanguage(locale); }, [locale]);
  useEffect(() => {
    setSlotId("");
    if (agentId && date) loadAvailability(agentId, date);
    else setAvailability([]);
  }, [agentId, date, serviceId]);
  useEffect(() => { setPage(1); }, [search, listFilter, dateFilter]);

  function bookingDayState(day) {
    if (startOfDay(day) < today || !sameMonth(day, month)) return "unavailable";
    return date === dateKey(day) ? "selected" : "available";
  }

  function listDayState(day) {
    const key = dateKey(day);
    if (!sameMonth(day, month)) return "outside";
    if (nextAppointment?.date === key) return "next";
    return appointmentDates.get(key) || "default";
  }

  function moveMonth(delta) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12));
  }

  function selectDay(day) {
    if (bookingDayState(day) === "unavailable") return;
    setDate(dateKey(day));
  }

  function resetBookingForm() {
    setReason("");
    setNotes("");
    setDate("");
    setSlotId("");
    setAvailability([]);
    setAccessibilityNeeds("");
    setPreferredLanguage(locale);
  }

  function openBooking() {
    setPageMode("booking");
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToList() {
    setPageMode("list");
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bookAnother() {
    setConfirmedAppointment(null);
    resetBookingForm();
    setPageMode("booking");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!selectedService || !selectedAgent || !date || !selectedSlot || !selectedSlot.isAvailable) {
      setError(copy.choose);
      return;
    }
    setSaving(true);
    try {
      const details = [
        notes.trim(),
        accessibilityNeeds.trim() ? `Accessibilité: ${accessibilityNeeds.trim()}` : "",
        contactPhone.trim() ? `Téléphone: ${contactPhone.trim()}` : "",
        preferredLanguage ? `Langue: ${preferredLanguage}` : "",
      ].filter(Boolean).join("\n");
      const created = await createCitizenAppointment({
        agent: selectedAgent.id,
        service: selectedService.id,
        starts_at: selectedSlot.startsAt,
        ends_at: selectedSlot.endsAt,
        reason: reason.trim(),
        details,
        reminder_enabled: true,
        reminder_minutes_before: 60,
      });
      setConfirmedAppointment(created);
      await Promise.all([loadLists(), loadAvailability(agentId, date)]);
    } catch (err) {
      if ([400, 409].includes(err?.response?.status)) {
        setError(getApiErrorMessage(err, copy.conflict));
        setSlotId("");
        await loadAvailability(agentId, date);
      } else {
        setError(getApiErrorMessage(err, copy.error));
      }
    } finally {
      setSaving(false);
    }
  }

  async function cancel(item) {
    if (!window.confirm(copy.cancelAsk)) return;
    try {
      await cancelCitizenAppointment(item.reference);
      setNotice(copy.cancelled);
      await loadLists();
    } catch (err) {
      setError(getApiErrorMessage(err, copy.error));
    }
  }

  const filteredAppointments = useMemo(() => {
    return allAppointments.filter((item) => {
      const category = appointmentCategory(item);
      if (listFilter !== "all" && category !== listFilter) return false;
      const query = search.trim().toLowerCase();
      if (query) {
        const haystack = [
          item.reference,
          item.serviceName,
          item.agentName,
          item.reason,
          getAppointmentStatusLabel(item.status),
        ].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (dateFilter === "thisMonth") {
        if (!item.date) return false;
        const d = parseDate(item.date);
        if (!(d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear())) return false;
      }
      if (dateFilter === "futureDates" && category !== "upcoming") return false;
      if (dateFilter === "pastDates" && category === "upcoming") return false;
      return true;
    });
  }, [allAppointments, listFilter, search, dateFilter, today]);

  const perPage = 6;
  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / perPage));
  const paginatedAppointments = filteredAppointments.slice((page - 1) * perPage, page * perPage);
  const isConfirmed = confirmedAppointment?.status === "confirmed";

  return (
    <div className="portal-layout">
      <CitizenSidebar />
      <div className="portal-main">
        <PortalTopbar eyebrow={copy.eyebrow} title={copy.title} />
        <main className="portal-content citizen-appointments-v82">
          <section className="cit-appt-page-head">
            <div>
              <div className="cit-appt-breadcrumb">{copy.eyebrow} / <strong>{copy.title}</strong></div>
              <h1>{copy.title}</h1>
              <p>{pageMode === "list" ? copy.listSubtitle : copy.bookingSubtitle}</p>
            </div>
          </section>

          {notice ? <div className="success-inline" role="status">{notice}</div> : null}
          {error ? <div className="error-card" role="alert">{error}</div> : null}

          {pageMode === "list" ? (
            <>
              <section className="cit-appt-hero-grid">
                <article className="portal-card cit-appt-hero-card">
                  <div className="cit-appt-hero-card__icon">📅</div>
                  <div className="cit-appt-hero-card__content">
                    <h2>{copy.heroTitle}</h2>
                    <p>{copy.heroText}</p>
                  </div>
                  <button type="button" className="cit-appt-primary" onClick={openBooking}>{copy.bookNow}</button>
                </article>
                <aside className="cit-appt-hero-visual" aria-hidden="true">
                  <div className="cit-appt-hero-visual__calendar">▦</div>
                </aside>
              </section>

              <section className="portal-card cit-appt-list-toolbar">
                <div className="cit-appt-filter-tabs" role="tablist" aria-label="Filtres rendez-vous">
                  {[
                    ["all", copy.all, listCounts.all],
                    ["upcoming", copy.upcoming, listCounts.upcoming],
                    ["past", copy.past, listCounts.past],
                    ["cancelled", copy.cancelledTab, listCounts.cancelled],
                  ].map(([key, label, count]) => (
                    <button key={key} type="button" className={listFilter === key ? "is-active" : ""} onClick={() => setListFilter(key)}>
                      <span>{label}</span>
                      <i>{count}</i>
                    </button>
                  ))}
                </div>
                <div className="cit-appt-toolbar-controls">
                  <label className="cit-appt-search-field">
                    <span aria-hidden="true">⌕</span>
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.search} />
                  </label>
                  <label className="cit-appt-date-filter">
                    <span aria-hidden="true">🗓</span>
                    <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
                      <option value="all">{copy.allDates}</option>
                      <option value="thisMonth">{copy.thisMonth}</option>
                      <option value="futureDates">{copy.futureDates}</option>
                      <option value="pastDates">{copy.pastDates}</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="cit-appt-list-layout">
                <div className="portal-card cit-appt-table-card">
                  <div className="cit-appt-table-head">
                    <strong>{copy.heroTitle}</strong>
                    <span>{filteredAppointments.length} rendez-vous</span>
                  </div>
                  <div className="cit-appt-table-wrap">
                    <table className="cit-appt-table">
                      <thead>
                        <tr>
                          <th>{copy.date}</th>
                          <th>{copy.time}</th>
                          <th>{copy.service}</th>
                          <th>{copy.agent}</th>
                          <th>{copy.reason}</th>
                          <th>{copy.status}</th>
                          <th>{copy.actions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedAppointments.map((item) => {
                          const category = appointmentCategory(item);
                          const theme = serviceTheme(item.serviceName);
                          return (
                            <tr key={item.reference}>
                              <td className="cit-appt-date-cell">
                                <strong>{item.date ? parseDate(item.date).getDate() : "—"}</strong>
                                <span>{item.date ? titleCase(shortDate(parseDate(item.date), locale)) : "—"}</span>
                              </td>
                              <td>{timeRange(item)}</td>
                              <td>
                                <div className={`cit-appt-service-chip theme-${theme}`}>
                                  <i />
                                  <span>{item.serviceName}</span>
                                </div>
                              </td>
                              <td>{item.agentName}</td>
                              <td>{item.reason || "—"}</td>
                              <td>
                                <span className={`cit-appt-status-pill is-${category}`}>{getAppointmentStatusLabel(item.status)}</span>
                              </td>
                              <td>
                                <div className="cit-appt-row-actions">
                                  <button type="button" className="cit-appt-view-btn" onClick={() => navigate(`/citizen/appointments/${encodeURIComponent(item.reference)}`)}>{copy.view}</button>
                                  {item.canCancel && category === "upcoming" ? (
                                    <button type="button" className="cit-appt-menu-btn" title={copy.cancelForm} onClick={() => cancel(item)}>⋯</button>
                                  ) : (
                                    <button type="button" className="cit-appt-menu-btn" aria-label="more" onClick={() => navigate(`/citizen/appointments/${encodeURIComponent(item.reference)}`)}>⋯</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {!paginatedAppointments.length ? (
                          <tr>
                            <td colSpan="7"><div className="cit-appt-empty">{copy.empty}</div></td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  <div className="cit-appt-pagination">
                    <span>{filteredAppointments.length} résultat(s)</span>
                    <div>
                      <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>‹</button>
                      <b>{page}</b>
                      <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>›</button>
                    </div>
                  </div>
                </div>

                <aside className="cit-appt-side-stack">
                  <section className="portal-card cit-appt-next-card">
                    <h3>{copy.nextAppointment}</h3>
                    {nextAppointment ? (
                      <>
                        <div className="cit-appt-next-date">{titleCase(longDate(parseDate(nextAppointment.date), locale))}</div>
                        <div className="cit-appt-next-info">
                          <div><span>{copy.timeLabel}</span><b>{timeRange(nextAppointment)}</b></div>
                          <div><span>{copy.service}</span><b>{nextAppointment.serviceName}</b></div>
                          <div><span>{copy.agent}</span><b>{nextAppointment.agentName}</b></div>
                          <div><span>{copy.reasonLabel}</span><b>{nextAppointment.reason || "—"}</b></div>
                        </div>
                        <button type="button" className="cit-appt-next-link" onClick={() => navigate(`/citizen/appointments/${encodeURIComponent(nextAppointment.reference)}`)}>→</button>
                      </>
                    ) : <div className="cit-appt-empty compact">{copy.empty}</div>}
                  </section>

                  <section className="portal-card cit-appt-calendar-card">
                    <div className="cit-appt-calendar-head">
                      <h3>{copy.calendar}</h3>
                    </div>
                    <div className="cit-appt-calendar-toolbar">
                      <button type="button" aria-label={copy.previous} onClick={() => moveMonth(-1)}>←</button>
                      <strong>{titleCase(monthLabel(month, locale))}</strong>
                      <button type="button" aria-label={copy.next} onClick={() => moveMonth(1)}>→</button>
                    </div>
                    <div className="cit-appt-calendar-weekdays">{copy.weekdays.map((day) => <span key={day}>{day}</span>)}</div>
                    <div className="cit-appt-calendar-grid">
                      {monthDays.map((day) => {
                        const state = listDayState(day);
                        return <div key={`list-${dateKey(day)}`} className={`cit-appt-calendar-day state-${state} ${!sameMonth(day, month) ? "is-outside" : ""}`}><span>{day.getDate()}</span></div>;
                      })}
                    </div>
                  </section>
                </aside>
              </section>
            </>
          ) : (
            <form className="cit-appt-booking-layout" onSubmit={submit}>
              <section className="portal-card cit-appt-booking-main">
                <div className="cit-appt-stepper">
                  <div className="is-active"><b>1</b><span>{copy.stepService}</span></div>
                  <i />
                  <div className={date ? "is-active" : ""}><b>2</b><span>{copy.stepDate}</span></div>
                  <i />
                  <div className={date && selectedSlot ? "is-active" : ""}><b>3</b><span>{copy.stepSummary}</span></div>
                </div>

                <div className="cit-appt-booking-fields">
                  <label>
                    <span>{copy.service}</span>
                    <div className="cit-appt-input-wrap"><i className="service" /><select value={serviceId} onChange={(event) => setServiceId(event.target.value)} required><option value="">—</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></div>
                  </label>
                  <label>
                    <span>{copy.agent}</span>
                    <div className="cit-appt-input-wrap"><i className="agent" /><select value={agentId} onChange={(event) => setAgentId(event.target.value)} required><option value="">{copy.chooseAgent}</option>{agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select></div>
                  </label>
                  <label className="full">
                    <span>{copy.reason}</span>
                    <div className="cit-appt-input-wrap"><i className="reason" /><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={copy.reasonPlaceholder} required /></div>
                  </label>
                </div>

                <div className="cit-appt-booking-panels">
                  <section className="cit-appt-panel">
                    <div className="cit-appt-panel-title"><b>2</b><div><h3>{copy.chooseDate}</h3><p>{copy.selectDateTitle}</p></div></div>
                    <div className="cit-appt-calendar-toolbar">
                      <button type="button" aria-label={copy.previous} onClick={() => moveMonth(-1)}>←</button>
                      <strong>{titleCase(monthLabel(month, locale))}</strong>
                      <button type="button" aria-label={copy.next} onClick={() => moveMonth(1)}>→</button>
                    </div>
                    <div className="cit-appt-calendar-weekdays">{copy.weekdays.map((day) => <span key={`book-${day}`}>{day}</span>)}</div>
                    <div className="cit-appt-calendar-grid booking">
                      {monthDays.map((day) => {
                        const key = dateKey(day);
                        const state = bookingDayState(day);
                        const disabled = !sameMonth(day, month) || state === "unavailable";
                        return (
                          <button
                            type="button"
                            key={`booking-${key}`}
                            className={`cit-appt-calendar-day state-${state} ${date === key ? "is-selected" : ""} ${!sameMonth(day, month) ? "is-outside" : ""}`}
                            onClick={() => selectDay(day)}
                            disabled={disabled}
                          >
                            <span>{day.getDate()}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="cit-appt-panel">
                    <div className="cit-appt-panel-title"><b>3</b><div><h3>{copy.slotTitle}</h3><p>{copy.slotHelp}</p></div></div>
                    <div className="cit-appt-duration-banner"><span>◷</span><b>{copy.appointmentDuration} : {slotDuration >= 60 ? copy.oneHour : `${slotDuration} min`}</b></div>
                    {selectedDate ? <div className="cit-appt-selected-day">{titleCase(longDate(selectedDate, locale))}</div> : null}
                    {!date ? (
                      <div className="cit-appt-empty">{copy.chooseDateFirst}</div>
                    ) : availabilityLoading ? (
                      <div className="cit-appt-empty">{copy.loadingSlots}</div>
                    ) : availability.length ? (
                      <div className="cit-appt-slot-grid">
                        {availability.map((slot) => {
                          const selected = String(slotId) === String(slot.id);
                          return (
                            <button type="button" key={slot.id} className={selected ? "is-selected" : ""} disabled={!slot.isAvailable} onClick={() => setSlotId(String(slot.id))}>
                              <strong>{slot.startTime}</strong>
                              <span>— {slot.endTime}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="cit-appt-empty">{copy.noSlots}</div>
                    )}
                    <div className="cit-appt-slot-legend">
                      <span><i className="available" />{copy.available}</span>
                      <span><i className="selected" />{copy.selected}</span>
                      <span><i className="unavailable" />{copy.unavailable}</span>
                    </div>
                  </section>
                </div>
              </section>

              <aside className="portal-card cit-appt-booking-side">
                <div className="cit-appt-side-visual" aria-hidden="true">📅</div>
                <h3>{copy.bookingPanelTitle}</h3>
                <div className="cit-appt-summary-list">
                  <div><span>{copy.service}</span><b>{selectedService?.name || "—"}</b></div>
                  <div><span>{copy.agent}</span><b>{selectedAgent?.name || "—"}</b></div>
                  <div><span>{copy.dateLabel}</span><b>{selectedDate ? titleCase(longDate(selectedDate, locale)) : "—"}</b></div>
                  <div><span>{copy.timeLabel}</span><b>{selectedSlot ? `${selectedSlot.startTime} – ${selectedSlot.endTime} (${slotDuration >= 60 ? copy.oneHour : `${slotDuration} min`})` : "—"}</b></div>
                  <div><span>{copy.reasonLabel}</span><b>{reason || "—"}</b></div>
                </div>
                <div className="cit-appt-note-box">ℹ {copy.note}</div>
                <button className="cit-appt-primary wide" type="submit" disabled={saving || !selectedService || !selectedAgent || !date || !selectedSlot || !reason.trim()}>
                  {saving ? `${copy.askAppointment}…` : copy.askAppointment}
                </button>
                <button className="cit-appt-secondary wide" type="button" onClick={backToList}>{copy.cancelForm}</button>
              </aside>
            </form>
          )}

          {confirmedAppointment ? (
            <div className="appointment-confirmation-backdrop" role="presentation">
              <section className="appointment-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="appointment-confirmation-title">
                <div className="appointment-confirmation-check" aria-hidden="true">✓</div>
                <span className="section-label">{getAppointmentStatusLabel(confirmedAppointment.status)}</span>
                <h2 id="appointment-confirmation-title">{isConfirmed ? copy.createdConfirmed : copy.createdPending}</h2>
                <p>{isConfirmed ? copy.createdTextConfirmed : copy.createdTextPending}</p>
                <div className="appointment-confirmation-facts">
                  <div><span>{copy.service}</span><b>{confirmedAppointment.serviceName}</b></div>
                  <div><span>{copy.agent}</span><b>{confirmedAppointment.agentName}</b></div>
                  <div><span>{copy.dateLabel}</span><b>{confirmedAppointment.date ? longDate(parseDate(confirmedAppointment.date), locale) : "—"}</b></div>
                  <div><span>{copy.timeLabel}</span><b>{confirmedAppointment.startTime}</b></div>
                  <div><span>{copy.reference}</span><b>{confirmedAppointment.reference}</b></div>
                  <div><span>{copy.status}</span><b>{getAppointmentStatusLabel(confirmedAppointment.status)}</b></div>
                </div>
                <div className="appointment-confirmation-actions">
                  <button type="button" className="secondary-action" onClick={() => navigate("/citizen")}>{copy.leavePage}</button>
                  <button type="button" className="secondary-action" onClick={() => navigate(`/citizen/appointments/${encodeURIComponent(confirmedAppointment.reference)}`)}>{copy.view}</button>
                  <button type="button" className="primary-action" onClick={bookAnother}>{copy.another}</button>
                </div>
              </section>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

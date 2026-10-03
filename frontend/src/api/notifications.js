import { api } from "./api.js";
import { formatDateTime, unwrapList } from "./helpers.js";

function normalizeNotification(item) {
  return {
    ...item,
    createdLabel: formatDateTime(item.created_at),
  };
}

export async function getCitizenNotifications(params = {}) {
  const { data } = await api.get("/citizen/notifications/", { params });
  return unwrapList(data).map(normalizeNotification);
}

export async function setNotificationRead(id, isRead = true) {
  const { data } = await api.patch(`/citizen/notifications/${encodeURIComponent(id)}/`, {
    is_read: Boolean(isRead),
  });
  return normalizeNotification(data);
}

export async function markAllNotificationsRead() {
  const { data } = await api.post("/citizen/notifications/read-all/");
  return data;
}

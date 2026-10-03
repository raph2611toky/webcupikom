from __future__ import annotations

import asyncio
import json
import time
from collections import deque
from datetime import timedelta
from uuid import UUID
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.utils import timezone

from apps.city.models import CitizenAppointment, CitizenNotification, CitizenRequest, StaffAuditEvent
from apps.city.services.news import visible_notifications
from apps.users.models import AccountSession, User

from .services import resource_group, role_group, session_group, staff_group, user_group
from .tickets import InvalidRealtimeTicket, RealtimeUnavailable, consume_ticket


@database_sync_to_async
def _load_identity(payload):
    try:
        user_id = int(payload.get("user_id"))
        security_version = int(payload.get("security_version"))
        sid = str(UUID(str(payload.get("sid") or "")))
    except (TypeError, ValueError, AttributeError):
        return None

    user = User.objects.filter(pk=user_id, is_active=True).first()
    if not user or user.auth_token_version != security_version:
        return None
    session = AccountSession.objects.filter(
        pk=sid,
        user=user,
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
        security_version=user.auth_token_version,
    ).first()
    if not session:
        return None
    return user, session


@database_sync_to_async
def _session_is_active(user_id, sid, security_version, role):
    return User.objects.filter(
        pk=user_id,
        is_active=True,
        auth_token_version=security_version,
        role=role,
        account_sessions__id=sid,
        account_sessions__revoked_at__isnull=True,
        account_sessions__expires_at__gt=timezone.now(),
        account_sessions__security_version=security_version,
    ).exists()


@database_sync_to_async
def _subscription_group(user_id, role, resource, identifier):
    identifier = str(identifier).strip()
    if not identifier or len(identifier) > 80:
        return None
    if resource == "request":
        item = CitizenRequest.objects.filter(reference=identifier).only("id", "citizen_id").first()
        if not item:
            return None
        if role == User.Role.CITIZEN and item.citizen_id != user_id:
            return None
        if role not in {User.Role.CITIZEN, User.Role.AGENT, User.Role.ADMIN}:
            return None
        return resource_group("request", item.pk)

    if resource == "appointment":
        item = CitizenAppointment.objects.filter(reference=identifier).only(
            "id", "citizen_id", "agent_id"
        ).first()
        if not item:
            return None
        if role == User.Role.CITIZEN and item.citizen_id != user_id:
            return None
        if role == User.Role.AGENT and item.agent_id != user_id:
            return None
        if role not in {User.Role.CITIZEN, User.Role.AGENT, User.Role.ADMIN}:
            return None
        return resource_group("appointment", item.pk)
    return None


@database_sync_to_async
def _state_snapshot(user_id, role):
    now = timezone.now()
    unread = CitizenNotification.objects.filter(
        user_id=user_id,
        is_read=False,
        visible_from__lte=now,
    ).filter(visible_notifications(now)).count()
    state = {"notifications_unread": unread}

    if role == User.Role.CITIZEN:
        state["requests_action_required"] = CitizenRequest.objects.filter(
            citizen_id=user_id,
            status=CitizenRequest.Status.ACTION_REQUIRED,
        ).count()
        state["appointments_upcoming"] = CitizenAppointment.objects.filter(
            citizen_id=user_id,
            status__in=[CitizenAppointment.Status.REQUESTED, CitizenAppointment.Status.CONFIRMED],
            ends_at__gte=now,
        ).count()
    elif role == User.Role.AGENT:
        state["assigned_requests_needing_action"] = CitizenRequest.objects.filter(
            assigned_to_id=user_id,
            status__in=[
                CitizenRequest.Status.SUBMITTED,
                CitizenRequest.Status.PENDING,
                CitizenRequest.Status.IN_PROGRESS,
            ],
        ).count()
        state["appointments_upcoming"] = CitizenAppointment.objects.filter(
            agent_id=user_id,
            status__in=[CitizenAppointment.Status.REQUESTED, CitizenAppointment.Status.CONFIRMED],
            ends_at__gte=now,
        ).count()
    elif role == User.Role.ADMIN:
        state["requests_awaiting_handling"] = CitizenRequest.objects.filter(
            status__in=[CitizenRequest.Status.SUBMITTED, CitizenRequest.Status.PENDING]
        ).count()
        state["audit_last_24h"] = StaffAuditEvent.objects.filter(
            created_at__gte=now - timedelta(hours=24)
        ).count()
    return state


class RealtimeConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self._closed = False
        self._dynamic_groups = set()
        self._seen_event_ids = set()
        self._seen_event_order = deque(maxlen=256)
        self._message_times = deque()
        self._recheck_task = None

        query = parse_qs(self.scope.get("query_string", b"").decode("utf-8", errors="ignore"))
        ticket = (query.get("ticket") or [""])[0]
        try:
            payload = await consume_ticket(ticket)
        except InvalidRealtimeTicket:
            await self.close(code=4401)
            return
        except RealtimeUnavailable:
            await self.close(code=1013)
            return

        identity = await _load_identity(payload)
        if not identity:
            await self.close(code=4401)
            return
        self.user, self.account_session = identity
        self.user_id = self.user.pk
        self.role = self.user.role
        self.security_version = self.user.auth_token_version
        self.session_id = str(self.account_session.pk)

        self._base_groups = {
            user_group(self.user_id),
            role_group(self.role),
            session_group(self.session_id),
        }
        if self.role in {User.Role.AGENT, User.Role.ADMIN}:
            self._base_groups.add(staff_group())

        try:
            for group in self._base_groups:
                await self.channel_layer.group_add(group, self.channel_name)
        except Exception:
            await self.close(code=1013)
            return

        await self.accept()
        await self.send_json(
            {
                "type": "connection.ready",
                "version": 1,
                "server_time": timezone.now().isoformat(),
                "role": self.role,
                "session_recheck_seconds": settings.REALTIME_SESSION_RECHECK_SECONDS,
                "http_fallback": True,
                "delivery": "best_effort",
                "source_of_truth": "http",
                "allowed_client_messages": ["ping", "sync", "subscribe", "unsubscribe"],
                "subscribable_resources": ["request", "appointment"],
            }
        )
        await self._send_snapshot()
        self._recheck_task = asyncio.create_task(self._session_recheck_loop())

    async def disconnect(self, close_code):
        self._closed = True
        if self._recheck_task:
            self._recheck_task.cancel()
        for group in getattr(self, "_dynamic_groups", set()) | getattr(self, "_base_groups", set()):
            try:
                await self.channel_layer.group_discard(group, self.channel_name)
            except Exception:
                pass

    def _within_rate_limit(self):
        now = time.monotonic()
        minute_ago = now - 60
        while self._message_times and self._message_times[0] < minute_ago:
            self._message_times.popleft()
        if len(self._message_times) >= settings.REALTIME_MAX_CLIENT_MESSAGES_PER_MINUTE:
            return False
        self._message_times.append(now)
        return True

    async def receive(self, text_data=None, bytes_data=None, **kwargs):
        if bytes_data is not None:
            await self.close(code=1003)
            return
        if text_data is None:
            return
        if len(text_data.encode("utf-8")) > settings.REALTIME_MAX_MESSAGE_BYTES:
            await self.close(code=1009)
            return
        if not self._within_rate_limit():
            await self.send_json({"type": "error", "code": "rate_limited"})
            await self.close(code=4429)
            return
        try:
            content = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send_json({"type": "error", "code": "invalid_json"})
            return
        if not isinstance(content, dict):
            await self.send_json({"type": "error", "code": "invalid_message"})
            return
        await self._handle_message(content)

    async def _handle_message(self, content):
        message_type = str(content.get("type") or "")
        if message_type == "ping":
            await self.send_json({"type": "pong", "server_time": timezone.now().isoformat()})
            return
        if message_type == "sync":
            await self._send_snapshot()
            return
        if message_type in {"subscribe", "unsubscribe"}:
            await self._handle_subscription(content, add=message_type == "subscribe")
            return
        await self.send_json({"type": "error", "code": "unsupported_message_type"})

    async def _handle_subscription(self, content, *, add):
        resource = str(content.get("resource") or "").strip().lower()
        identifier = content.get("id")
        if resource not in {"request", "appointment"} or not identifier:
            await self.send_json({"type": "error", "code": "invalid_subscription"})
            return
        group = await _subscription_group(self.user_id, self.role, resource, identifier)
        if not group:
            await self.send_json({"type": "error", "code": "subscription_forbidden"})
            return
        if add:
            if len(self._dynamic_groups) >= settings.REALTIME_MAX_RESOURCE_SUBSCRIPTIONS:
                await self.send_json({"type": "error", "code": "subscription_limit"})
                return
            await self.channel_layer.group_add(group, self.channel_name)
            self._dynamic_groups.add(group)
            result = "subscribed"
        else:
            await self.channel_layer.group_discard(group, self.channel_name)
            self._dynamic_groups.discard(group)
            result = "unsubscribed"
        await self.send_json(
            {"type": f"resource.{result}", "resource": resource, "id": str(identifier)}
        )

    async def _send_snapshot(self):
        state = await _state_snapshot(self.user_id, self.role)
        await self.send_json(
            {
                "type": "state.snapshot",
                "server_time": timezone.now().isoformat(),
                "state": state,
            }
        )

    async def _session_recheck_loop(self):
        try:
            while not self._closed:
                await asyncio.sleep(settings.REALTIME_SESSION_RECHECK_SECONDS)
                active = await _session_is_active(
                    self.user_id, self.session_id, self.security_version, self.role
                )
                if not active:
                    await self.send_json(
                        {"type": "security.session_invalid", "http_reauthentication_required": True}
                    )
                    await self.close(code=4401)
                    return
        except asyncio.CancelledError:
            return

    async def realtime_event(self, event):
        event_id = event.get("event_id")
        if event_id and event_id in self._seen_event_ids:
            return
        if event_id:
            if len(self._seen_event_order) == self._seen_event_order.maxlen:
                oldest = self._seen_event_order.popleft()
                self._seen_event_ids.discard(oldest)
            self._seen_event_order.append(event_id)
            self._seen_event_ids.add(event_id)

        event_name = str(event.get("event") or "")
        await self.send_json(
            {
                "type": "event",
                "event": event_name,
                "event_id": event_id,
                "occurred_at": event.get("occurred_at"),
                "version": event.get("version", 1),
                "payload": event.get("payload") or {},
            }
        )
        if event_name in {"security.session_revoked", "security.sessions_revoked", "security.account_disabled", "security.permissions_changed"}:
            await self.close(code=4401)

import hashlib
import json
import os
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path


class ConversationStore:
    def __init__(self, path: str, ttl_hours: int = 24):
        self.path = str(Path(path).resolve())
        self.ttl = timedelta(hours=ttl_hours)
        self._lock = threading.RLock()
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        try:
            os.chmod(self.path, 0o600)
        except OSError:
            pass

    def _connect(self):
        con = sqlite3.connect(self.path, timeout=10)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA journal_mode=WAL")
        con.execute("PRAGMA busy_timeout=5000")
        return con

    def _init_db(self):
        with self._connect() as con:
            con.executescript(
                """
                CREATE TABLE IF NOT EXISTS sms_conversation (
                    phone TEXT PRIMARY KEY,
                    state_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sms_processed (
                    client_reference TEXT PRIMARY KEY,
                    phone TEXT NOT NULL,
                    reply TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )

    @staticmethod
    def _phone_key(phone: str) -> str:
        return hashlib.sha256((phone or "").strip().encode("utf-8")).hexdigest()

    def get(self, phone: str) -> dict:
        phone = self._phone_key(phone)
        now = datetime.now(timezone.utc)
        with self._lock, self._connect() as con:
            row = con.execute(
                "SELECT state_json, updated_at FROM sms_conversation WHERE phone=?", (phone,)
            ).fetchone()
            if not row:
                return self.empty_state()
            updated = datetime.fromisoformat(row["updated_at"])
            if now - updated > self.ttl:
                con.execute("DELETE FROM sms_conversation WHERE phone=?", (phone,))
                return self.empty_state()
            try:
                state = json.loads(row["state_json"])
            except Exception:
                return self.empty_state()
            return {**self.empty_state(), **state}

    def save(self, phone: str, state: dict):
        phone = self._phone_key(phone)
        payload = json.dumps(state, ensure_ascii=False, default=str)
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._connect() as con:
            con.execute(
                """INSERT INTO sms_conversation(phone,state_json,updated_at) VALUES(?,?,?)
                   ON CONFLICT(phone) DO UPDATE SET state_json=excluded.state_json, updated_at=excluded.updated_at""",
                (phone, payload, now),
            )

    def reset(self, phone: str):
        phone = self._phone_key(phone)
        with self._lock, self._connect() as con:
            con.execute("DELETE FROM sms_conversation WHERE phone=?", (phone,))

    def get_processed(self, client_reference: str):
        if not client_reference:
            return None
        with self._lock, self._connect() as con:
            row = con.execute(
                "SELECT reply FROM sms_processed WHERE client_reference=?", (client_reference,)
            ).fetchone()
            return row["reply"] if row else None

    def mark_processed(self, client_reference: str, phone: str, reply: str):
        if not client_reference:
            return
        phone = self._phone_key(phone)
        with self._lock, self._connect() as con:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            con.execute("DELETE FROM sms_processed WHERE created_at < ?", (cutoff,))
            con.execute(
                "INSERT OR IGNORE INTO sms_processed(client_reference,phone,reply,created_at) VALUES(?,?,?,?)",
                (client_reference, phone, reply, datetime.now(timezone.utc).isoformat()),
            )

    @staticmethod
    def empty_state():
        return {
            "intent": None,
            "draft": {},
            "phase": "idle",
            "validation": {},
            "last_reference": None,
        }

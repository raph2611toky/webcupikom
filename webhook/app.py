import logging
import os
import secrets
import uuid
from pathlib import Path
from typing import Dict

import requests
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request

load_dotenv(Path(__file__).with_name('.env'))

from conversation_engine import ConversationEngine
from conversation_store import ConversationStore
from django_bridge import NovaTerraBridge
from gemini_service import GeminiService


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _normalize_base_url(value: str) -> str:
    value = (value or "").strip().rstrip("/")
    if not value:
        raise RuntimeError("ANDROID_SMS_BASE_URL est obligatoire.")
    if not (value.startswith("http://") or value.startswith("https://")):
        raise RuntimeError("ANDROID_SMS_BASE_URL doit commencer par http:// ou https://")
    return value


ANDROID_SMS_BASE_URL = _normalize_base_url(os.getenv("ANDROID_SMS_BASE_URL", "http://192.168.8.8:8000"))
ANDROID_SMS_SEND_PATH = "/sms/webhook/send/"
ANDROID_SMS_SEND_URL = f"{ANDROID_SMS_BASE_URL}{ANDROID_SMS_SEND_PATH}"
INBOUND_SMS_PATH = "/api/chatbot/sms/webhook/"

GATEWAY_WEBHOOK_TOKEN = (os.getenv("GATEWAY_WEBHOOK_TOKEN") or "").strip()
ANDROID_WEBHOOK_TOKEN = (os.getenv("ANDROID_WEBHOOK_TOKEN") or GATEWAY_WEBHOOK_TOKEN or "").strip()
CONNECT_TIMEOUT_SECONDS = float(os.getenv("GATEWAY_CONNECT_TIMEOUT_SECONDS", "4"))
READ_TIMEOUT_SECONDS = float(os.getenv("GATEWAY_READ_TIMEOUT_SECONDS", "15"))
MAX_BODY_BYTES = int(os.getenv("GATEWAY_MAX_BODY_BYTES", "65536"))
ENABLE_UPSTREAM_HEALTH = _env_bool("GATEWAY_ENABLE_UPSTREAM_HEALTH", True)

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("nova_terra_sms_gateway")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_BODY_BYTES
session = requests.Session()

store = ConversationStore(
    os.getenv("SMS_AI_DB_PATH", str(Path(__file__).with_name("sms_gateway_state.sqlite3"))),
    ttl_hours=int(os.getenv("SMS_AI_SESSION_TTL_HOURS", "24")),
)
bridge = NovaTerraBridge()
gemini = GeminiService()
engine = ConversationEngine(store=store, bridge=bridge, gemini=gemini)

HOP_BY_HOP_HEADERS = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te",
    "trailer", "transfer-encoding", "upgrade", "host", "content-length",
}


def _request_id() -> str:
    incoming = (request.headers.get("X-Request-ID") or "").strip()
    return incoming[:128] if incoming else str(uuid.uuid4())


def _authorized() -> bool:
    if not GATEWAY_WEBHOOK_TOKEN:
        return False
    received = (request.headers.get("x-webhook-token") or "").strip()
    return bool(received) and secrets.compare_digest(received, GATEWAY_WEBHOOK_TOKEN)


def _forward_headers(request_id: str) -> Dict[str, str]:
    headers: Dict[str, str] = {}
    for name, value in request.headers.items():
        lower = name.lower()
        if lower in HOP_BY_HOP_HEADERS or lower.startswith("x-forwarded-") or lower.startswith("cf-"):
            continue
        headers[name] = value
    headers["Content-Type"] = request.headers.get("Content-Type", "application/json; charset=utf-8")
    headers["Accept"] = request.headers.get("Accept", "application/json")
    headers["X-Request-ID"] = request_id
    if ANDROID_WEBHOOK_TOKEN:
        headers["x-webhook-token"] = ANDROID_WEBHOOK_TOKEN
    else:
        headers.pop("x-webhook-token", None)
    return headers


def _gateway_error(status: int, message: str, request_id: str) -> Response:
    response = jsonify({
        "success": False,
        "message": message,
        "gateway": "nova-terra-sms-gateway",
        "request_id": request_id,
    })
    response.status_code = status
    response.headers["X-Request-ID"] = request_id
    return response


@app.get("/health/")
def health() -> Response:
    return jsonify({
        "success": True,
        "service": "nova-terra-sms-gateway",
        "android_upstream": ANDROID_SMS_BASE_URL,
        "inbound_endpoint": INBOUND_SMS_PATH,
        "gemini_configured": gemini.enabled,
        "backend_path": str(bridge.backend_path),
    })


@app.get("/health/upstream/")
def upstream_health() -> Response:
    request_id = _request_id()
    if not ENABLE_UPSTREAM_HEALTH:
        return _gateway_error(404, "Vérification upstream désactivée.", request_id)
    url = f"{ANDROID_SMS_BASE_URL}/sms/webhook/health/"
    headers = {"Accept": "application/json", "X-Request-ID": request_id}
    if ANDROID_WEBHOOK_TOKEN:
        headers["x-webhook-token"] = ANDROID_WEBHOOK_TOKEN
    try:
        upstream = session.get(url, headers=headers, timeout=(CONNECT_TIMEOUT_SECONDS, READ_TIMEOUT_SECONDS))
    except requests.Timeout:
        return _gateway_error(504, "Le téléphone SMS ne répond pas à temps.", request_id)
    except requests.RequestException:
        return _gateway_error(502, "Le téléphone SMS est injoignable.", request_id)
    response = Response(upstream.content, status=upstream.status_code, content_type=upstream.headers.get("Content-Type", "application/json"))
    response.headers["X-Request-ID"] = request_id
    return response


@app.post(INBOUND_SMS_PATH)
def incoming_sms() -> Response:
    """Android -> gateway IA -> réponse JSON {reply} -> Android SmsManager."""
    request_id = _request_id()
    if not _authorized():
        logger.warning("SMS entrant refusé request_id=%s", request_id)
        return _gateway_error(403, "Token webhook invalide.", request_id)
    if not request.is_json:
        return _gateway_error(415, "Content-Type application/json requis.", request_id)
    payload = request.get_json(silent=True) or {}
    phone = str(payload.get("address") or payload.get("phone_number") or payload.get("from") or "").strip()
    text = str(payload.get("body") or payload.get("message") or payload.get("contenu") or "").strip()
    client_reference = str(payload.get("client_reference") or "").strip()
    if not phone or not text:
        return _gateway_error(400, "address et body sont obligatoires.", request_id)
    try:
        reply = engine.process(phone=phone, text=text, client_reference=client_reference)
    except Exception:
        logger.exception("Erreur orchestration SMS request_id=%s", request_id)
        reply = "Nova Terra SMS est momentanément indisponible. Votre demande n'a pas été enregistrée. Réessayez plus tard."
    response = jsonify({"success": True, "reply": reply, "request_id": request_id})
    response.headers["X-Request-ID"] = request_id
    return response


@app.post(ANDROID_SMS_SEND_PATH)
def forward_sms() -> Response:
    """Backend/gateway -> Android pour les SMS sortants asynchrones."""
    request_id = _request_id()
    if not _authorized():
        logger.warning("Requête SMS sortante refusée request_id=%s", request_id)
        return _gateway_error(403, "Token webhook invalide.", request_id)
    raw_body = request.get_data(cache=True, as_text=False)
    if not raw_body:
        return _gateway_error(400, "Body JSON requis.", request_id)
    if not request.is_json:
        return _gateway_error(415, "Content-Type application/json requis.", request_id)
    if request.get_json(silent=True) is None:
        return _gateway_error(400, "Body JSON invalide.", request_id)
    try:
        upstream = session.post(
            ANDROID_SMS_SEND_URL,
            data=raw_body,
            headers=_forward_headers(request_id),
            timeout=(CONNECT_TIMEOUT_SECONDS, READ_TIMEOUT_SECONDS),
            allow_redirects=False,
        )
    except requests.ConnectTimeout:
        return _gateway_error(504, "Connexion au téléphone SMS expirée.", request_id)
    except requests.ReadTimeout:
        return _gateway_error(504, "Le téléphone SMS n'a pas répondu à temps.", request_id)
    except requests.ConnectionError:
        return _gateway_error(502, "Le téléphone SMS est injoignable.", request_id)
    except requests.RequestException:
        logger.exception("Erreur proxy request_id=%s", request_id)
        return _gateway_error(502, "Erreur de transmission vers le téléphone SMS.", request_id)

    response = Response(upstream.content, status=upstream.status_code, content_type=upstream.headers.get("Content-Type", "application/json"))
    response.headers["X-Request-ID"] = request_id
    response.headers["X-SMS-Gateway-Upstream-Status"] = str(upstream.status_code)
    return response


@app.errorhandler(413)
def payload_too_large(_error):
    return _gateway_error(413, "Payload trop volumineux.", _request_id())


@app.errorhandler(404)
def not_found(_error):
    return _gateway_error(404, "Endpoint introuvable.", _request_id())


if __name__ == "__main__":
    app.run(
        host=os.getenv("GATEWAY_HOST", "0.0.0.0"),
        port=int(os.getenv("GATEWAY_PORT", "8080")),
        debug=False,
        threaded=True,
    )

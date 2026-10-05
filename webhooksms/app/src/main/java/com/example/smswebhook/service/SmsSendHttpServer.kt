package com.example.smswebhook.service

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SmsManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.example.smswebhook.util.Env
import fi.iki.elonen.NanoHTTPD
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicLong

/**
 * Serveur HTTP local Django/Gateway -> Android.
 *
 * Les routes et le comportement métier restent identiques à la version
 * précédente. Les seules additions ici sont des métriques/heartbeats légers
 * permettant au foreground service de distinguer "socket ouvert" de
 * "requêtes réellement traitées".
 */
class SmsSendHttpServer(
    private val appContext: Context,
    port: Int,
    private val webhookToken: String,
    private val isServiceEnabled: () -> Boolean
) : NanoHTTPD("0.0.0.0", port) {

    private val requestCounter = AtomicLong(0L)

    @Volatile
    private var lastRequestStartedAtMs: Long = 0L

    @Volatile
    private var lastRequestCompletedAtMs: Long = 0L

    @Volatile
    private var lastNonHealthRequestAtMs: Long = 0L

    override fun serve(session: IHTTPSession): Response {
        val startedAt = System.currentTimeMillis()
        val sequence = requestCounter.incrementAndGet()
        val normalizedUri = normalizePath(session.uri)

        lastRequestStartedAtMs = startedAt

        if (normalizedUri != Env.LOCAL_SMS_HEALTH_PATH) {
            lastNonHealthRequestAtMs = startedAt
            Log.i(
                TAG,
                "HTTP #$sequence ${session.method} $normalizedUri thread=${Thread.currentThread().name}"
            )
        }

        return try {
            handleSession(session, normalizedUri)
        } catch (e: Exception) {
            Log.e(TAG, "Erreur endpoint SMS local: ${e.message}", e)

            jsonResponse(
                Response.Status.INTERNAL_ERROR,
                JSONObject()
                    .put("success", false)
                    .put("error", e.message ?: "Erreur inconnue")
            )
        } finally {
            lastRequestCompletedAtMs = System.currentTimeMillis()
        }
    }

    /**
     * Le code fonctionnel de l'endpoint est volontairement gardé séparé du
     * wrapper de diagnostic afin de ne rien changer à l'envoi SMS existant.
     */
    private fun handleSession(session: IHTTPSession, uri: String): Response {
        val method = session.method

        if (method == Method.OPTIONS) {
            return corsResponse(
                newFixedLengthResponse(
                    Response.Status.OK,
                    "application/json",
                    """{"success":true}"""
                )
            )
        }

        if (uri == Env.LOCAL_SMS_HEALTH_PATH && method == Method.GET) {
            return jsonResponse(
                Response.Status.OK,
                JSONObject()
                    .put("success", true)
                    .put("service", "sms-gateway")
                    .put("enabled", isServiceEnabled())
                    .put("application_enabled", isServiceEnabled())
                    .put("timestamp", System.currentTimeMillis())
                    .put("request_count", requestCounter.get())
                    .put("last_request_started_at", lastRequestStartedAtMs)
                    .put("last_request_completed_at", lastRequestCompletedAtMs)
                    .put("last_non_health_request_at", lastNonHealthRequestAtMs)
            )
        }

        if (uri != Env.LOCAL_SMS_SEND_PATH) {
            return jsonResponse(
                Response.Status.NOT_FOUND,
                JSONObject()
                    .put("success", false)
                    .put("error", "Endpoint introuvable")
            )
        }

        if (method != Method.POST) {
            return jsonResponse(
                Response.Status.METHOD_NOT_ALLOWED,
                JSONObject()
                    .put("success", false)
                    .put("error", "Méthode non autorisée. Utilisez POST.")
            )
        }

        if (!isServiceEnabled()) {
            return jsonResponse(
                Response.Status.FORBIDDEN,
                JSONObject()
                    .put("success", false)
                    .put("error", "Service SMS désactivé")
            )
        }

        val receivedToken = getHeader(session, "x-webhook-token")

        if (webhookToken.isNotBlank() && receivedToken != webhookToken) {
            return jsonResponse(
                Response.Status.FORBIDDEN,
                JSONObject()
                    .put("success", false)
                    .put("error", "Token invalide")
            )
        }

        if (!hasSendSmsPermission()) {
            return jsonResponse(
                Response.Status.FORBIDDEN,
                JSONObject()
                    .put("success", false)
                    .put("error", "Permission SEND_SMS manquante")
            )
        }

        val body = readBody(session)

        if (body.isBlank()) {
            return jsonResponse(
                Response.Status.BAD_REQUEST,
                JSONObject()
                    .put("success", false)
                    .put("error", "Body JSON requis")
            )
        }

        val json = JSONObject(body)

        val phoneNumber = json.optString("phone_number")
            .ifBlank { json.optString("phoneNumber") }
            .ifBlank { json.optString("to") }
            .trim()

        val contenu = json.optString("contenu")
            .ifBlank { json.optString("message") }
            .ifBlank { json.optString("body") }
            .trim()

        val subscriptionId = json.optInt("subscription_id", -1)

        if (phoneNumber.isBlank()) {
            return jsonResponse(
                Response.Status.BAD_REQUEST,
                JSONObject()
                    .put("success", false)
                    .put("error", "phone_number requis")
            )
        }

        if (contenu.isBlank()) {
            return jsonResponse(
                Response.Status.BAD_REQUEST,
                JSONObject()
                    .put("success", false)
                    .put("error", "contenu requis")
            )
        }

        sendSms(
            phoneNumber = phoneNumber,
            message = contenu,
            subscriptionId = subscriptionId
        )

        return jsonResponse(
            Response.Status.OK,
            JSONObject()
                .put("success", true)
                .put("message", "SMS envoyé")
                .put("phone_number", phoneNumber)
                .put("subscription_id", subscriptionId)
        )
    }

    private fun sendSms(
        phoneNumber: String,
        message: String,
        subscriptionId: Int
    ) {
        val cleanPhone = phoneNumber.trim()
        val cleanMessage = message.trim()

        if (!isServiceEnabled()) {
            throw IllegalStateException("Service SMS désactivé")
        }

        if (cleanPhone.isBlank() || cleanMessage.isBlank()) {
            throw IllegalArgumentException("Numéro ou message vide")
        }

        val smsManager = if (
            subscriptionId != -1 &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1
        ) {
            SmsManager.getSmsManagerForSubscriptionId(subscriptionId)
        } else {
            SmsManager.getDefault()
        }

        val parts = ArrayList(smsManager.divideMessage(cleanMessage))

        smsManager.sendMultipartTextMessage(
            cleanPhone,
            null,
            parts,
            null,
            null
        )

        Log.i(TAG, "SMS envoyé vers $cleanPhone")
    }

    fun diagnostics(): String {
        val now = System.currentTimeMillis()
        val startedAge = if (lastRequestStartedAtMs > 0L) {
            now - lastRequestStartedAtMs
        } else {
            -1L
        }
        val completedAge = if (lastRequestCompletedAtMs > 0L) {
            now - lastRequestCompletedAtMs
        } else {
            -1L
        }

        return "requests=${requestCounter.get()} " +
            "lastStartAgeMs=$startedAge lastCompleteAgeMs=$completedAge " +
            "nanoAlive=$isAlive listeningPort=$listeningPort"
    }

    private fun hasSendSmsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            appContext,
            Manifest.permission.SEND_SMS
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun readBody(session: IHTTPSession): String {
        val files = HashMap<String, String>()
        session.parseBody(files)

        return files["postData"].orEmpty()
    }

    private fun getHeader(session: IHTTPSession, name: String): String {
        val lowerName = name.lowercase()

        return session.headers[lowerName]
            ?: session.headers[name]
            ?: ""
    }

    private fun normalizePath(path: String): String {
        if (path.endsWith("/")) {
            return path
        }

        return "$path/"
    }

    private fun jsonResponse(status: Response.Status, json: JSONObject): Response {
        return corsResponse(
            newFixedLengthResponse(
                status,
                "application/json",
                json.toString()
            )
        )
    }

    private fun corsResponse(response: Response): Response {
        response.addHeader("Access-Control-Allow-Origin", "*")
        response.addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        response.addHeader("Access-Control-Allow-Headers", "Content-Type, x-webhook-token")
        return response
    }

    companion object {
        private const val TAG = "SmsSendHttpServer"
    }
}

package com.example.smswebhook.util

import android.content.Context
import android.content.SharedPreferences
import java.net.URI
import java.security.MessageDigest
import kotlin.math.abs

class Prefs(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("sms_webhook_prefs", Context.MODE_PRIVATE)

    private val BROADCAST_MARKER_RETENTION_MS = 24L * 60L * 60L * 1000L
    private val MAX_BROADCAST_MARKERS_PER_CONTENT = 20

    fun saveLastSmsId(id: Long) = prefs.edit().putLong("last_sms_id", id).apply()
    fun getLastSmsId(): Long = prefs.getLong("last_sms_id", 0L)

    fun saveLastMmsId(id: Long) = prefs.edit().putLong("last_mms_id", id).apply()
    fun getLastMmsId(): Long = prefs.getLong("last_mms_id", 0L)

    fun saveBackendConfig(host: String, port: String, portEnabled: Boolean) {
        prefs.edit()
            .putString("backend_host", sanitizeHostForStorage(host))
            .putString("backend_port", sanitizePortForStorage(port))
            .putBoolean("backend_port_enabled", portEnabled)
            .putBoolean("backend_config_initialized", true)
            .apply()
    }

    fun getBackendHost(): String =
        prefs.getString("backend_host", Env.DEFAULT_BACKEND_HOST) ?: Env.DEFAULT_BACKEND_HOST

    fun getBackendPort(): String =
        prefs.getString("backend_port", Env.DEFAULT_BACKEND_PORT.toString())
            ?: Env.DEFAULT_BACKEND_PORT.toString()

    fun isBackendPortEnabled(): Boolean =
        prefs.getBoolean("backend_port_enabled", Env.DEFAULT_BACKEND_PORT_ENABLED)

    fun getWebhookUrl(): String = buildWebhookUrl(
        hostInput = getBackendHost(),
        portInput = getBackendPort(),
        portEnabled = isBackendPortEnabled()
    )

    /*
     * Interrupteur maître. Lorsqu'il est désactivé, aucun service, receiver ou
     * worker de l'application ne doit fonctionner en arrière-plan. Les autres
     * préférences sont conservées afin de restaurer le même état à la
     * réactivation.
     */
    fun setApplicationEnabled(enabled: Boolean) {
        val editor = prefs.edit().putBoolean("application_enabled", enabled)
        if (!enabled) {
            editor.putBoolean("inbound_resume_baseline_required", true)
        }
        editor.apply()
    }

    fun isApplicationEnabled(): Boolean =
        prefs.getBoolean("application_enabled", true)

    /*
     * Contrôle uniquement la chaîne SMS entrant -> webhook Django -> réponse
     * SMS automatique. Le serveur HTTP local Django -> Android reste indépendant.
     */
    fun setAutoReplyWebhookEnabled(enabled: Boolean) {
        val editor = prefs.edit().putBoolean("auto_reply_webhook_enabled", enabled)
        if (!enabled) {
            editor.putBoolean("inbound_resume_baseline_required", true)
        }
        editor.apply()
    }

    fun isAutoReplyWebhookEnabled(): Boolean =
        prefs.getBoolean("auto_reply_webhook_enabled", true)

    fun isAutoReplyWebhookActive(): Boolean =
        isApplicationEnabled() && isAutoReplyWebhookEnabled()

    fun isInboundResumeBaselineRequired(): Boolean =
        prefs.getBoolean("inbound_resume_baseline_required", false)

    fun clearInboundResumeBaselineRequired() {
        prefs.edit().putBoolean("inbound_resume_baseline_required", false).apply()
    }

    /*
     * Contrôle uniquement le serveur HTTP local Django -> Android.
     */
    fun setOutboundServerEnabled(enabled: Boolean) {
        val wasEnabled = isOutboundServerEnabled()

        val editor = prefs.edit()
            .putBoolean("sms_gateway_enabled", enabled)

        if (enabled && !wasEnabled) {
            editor.putLong("sms_gateway_enabled_at", System.currentTimeMillis())
        }

        editor.apply()
    }

    fun isOutboundServerEnabled(): Boolean =
        prefs.getBoolean("sms_gateway_enabled", true)

    fun isOutboundServerActive(): Boolean =
        isApplicationEnabled() && isOutboundServerEnabled()

    fun getOutboundServerEnabledAt(): Long =
        prefs.getLong("sms_gateway_enabled_at", 0L)

    // Compatibilité avec le code / les préférences des anciennes versions.
    fun setSmsGatewayEnabled(enabled: Boolean) = setOutboundServerEnabled(enabled)
    fun isSmsGatewayEnabled(): Boolean = isOutboundServerActive()
    fun getSmsGatewayEnabledAt(): Long = getOutboundServerEnabledAt()

    /*
     * La réception système n'est traitée que si l'application et le webhook
     * automatique sont actifs. Le timestamp n'est volontairement pas filtré.
     */
    fun shouldProcessMessage(timestampMs: Long): Boolean = isAutoReplyWebhookActive()

    fun setWebhookEnabled(enabled: Boolean) = setAutoReplyWebhookEnabled(enabled)
    fun isWebhookEnabled(): Boolean = isAutoReplyWebhookActive()


    /**
     * Enregistre une occurrence capturée par SMS_RECEIVED. On conserve plusieurs
     * occurrences pour un même contenu : deux vrais SMS "CONFIRMER" identiques
     * envoyés à une minute d'intervalle ne doivent pas être confondus.
     */
    @Synchronized
    fun rememberBroadcastInbound(address: String, body: String, sourceTimestampMs: Long) {
        val digest = inboundContentDigest(address, body)
        val now = System.currentTimeMillis()
        val key = "broadcast_inbound_markers_$digest"
        val markers = readBroadcastMarkers(key)
            .filter { now - it.second in 0..BROADCAST_MARKER_RETENTION_MS }
            .toMutableList()

        markers.add(sourceTimestampMs to now)
        while (markers.size > MAX_BROADCAST_MARKERS_PER_CONTENT) {
            markers.removeAt(0)
        }

        prefs.edit().putString(key, encodeBroadcastMarkers(markers)).apply()
        pruneBroadcastInboundMarkers(now)
    }

    /**
     * Consomme UNE occurrence Broadcast correspondant à la ligne Inbox.
     *
     * Le marqueur est consommé : si un second SMS identique n'a jamais déclenché
     * SMS_RECEIVED, il restera sans marqueur et sera correctement récupéré depuis
     * l'Inbox au lieu d'être supprimé comme faux doublon.
     */
    @Synchronized
    fun consumeBroadcastCapture(
        address: String,
        body: String,
        inboxTimestampMs: Long,
        sourceToleranceMs: Long = 5L * 60L * 1000L,
        markerMaxAgeMs: Long = 10L * 60L * 1000L
    ): Boolean {
        val digest = inboundContentDigest(address, body)
        val key = "broadcast_inbound_markers_$digest"
        val now = System.currentTimeMillis()
        val markers = readBroadcastMarkers(key).toMutableList()

        var bestIndex = -1
        var bestDelta = Long.MAX_VALUE
        markers.forEachIndexed { index, marker ->
            val (sourceTimestamp, seenAt) = marker
            if (now - seenAt !in 0..markerMaxAgeMs) return@forEachIndexed
            val delta = abs(sourceTimestamp - inboxTimestampMs)
            if (delta <= sourceToleranceMs && delta < bestDelta) {
                bestIndex = index
                bestDelta = delta
            }
        }

        val kept = markers.filterIndexed { index, marker ->
            val fresh = now - marker.second in 0..BROADCAST_MARKER_RETENTION_MS
            fresh && index != bestIndex
        }

        val editor = prefs.edit()
        if (kept.isEmpty()) editor.remove(key)
        else editor.putString(key, encodeBroadcastMarkers(kept))
        editor.apply()

        return bestIndex >= 0
    }

    private fun inboundContentDigest(address: String, body: String): String {
        val normalizedAddress = address
            .replace("\\s+".toRegex(), "")
            .replace("-", "")
            .trim()
        val normalizedBody = body.trim().replace("\\s+".toRegex(), " ")
        val raw = "$normalizedAddress|$normalizedBody"
        val bytes = MessageDigest.getInstance("SHA-256")
            .digest(raw.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private fun readBroadcastMarkers(key: String): List<Pair<Long, Long>> =
        prefs.getString(key, "")
            .orEmpty()
            .split(';')
            .mapNotNull { item ->
                val parts = item.split(':', limit = 2)
                val source = parts.getOrNull(0)?.toLongOrNull() ?: return@mapNotNull null
                val seen = parts.getOrNull(1)?.toLongOrNull() ?: return@mapNotNull null
                source to seen
            }

    private fun encodeBroadcastMarkers(markers: List<Pair<Long, Long>>): String =
        markers.joinToString(";") { (source, seen) -> "$source:$seen" }

    private fun pruneBroadcastInboundMarkers(nowMs: Long) {
        val editor = prefs.edit()
        var changed = false

        prefs.all.forEach { (key, _) ->
            if (!key.startsWith("broadcast_inbound_markers_")) return@forEach
            val kept = readBroadcastMarkers(key)
                .filter { nowMs - it.second in 0..BROADCAST_MARKER_RETENTION_MS }
            val current = prefs.getString(key, "").orEmpty()
            val encoded = encodeBroadcastMarkers(kept)
            if (encoded == current) return@forEach

            if (kept.isEmpty()) editor.remove(key) else editor.putString(key, encoded)
            changed = true
        }

        if (changed) editor.apply()
    }

    fun saveLastInboundCapturedAt(timestampMs: Long) =
        prefs.edit().putLong("last_inbound_captured_at", timestampMs).apply()

    fun getLastInboundCapturedAt(): Long =
        prefs.getLong("last_inbound_captured_at", 0L)

    fun saveLastInboundBackendAt(timestampMs: Long) =
        prefs.edit().putLong("last_inbound_backend_at", timestampMs).apply()

    fun getLastInboundBackendAt(): Long =
        prefs.getLong("last_inbound_backend_at", 0L)

    fun saveLastInboundReplyAt(timestampMs: Long) =
        prefs.edit().putLong("last_inbound_reply_at", timestampMs).apply()

    fun getLastInboundReplyAt(): Long =
        prefs.getLong("last_inbound_reply_at", 0L)

    fun saveLastInboundFingerprint(fingerprint: String, timestampMs: Long) {
        prefs.edit()
            .putString("last_inbound_fingerprint", fingerprint)
            .putLong("last_inbound_timestamp", timestampMs)
            .putLong(processedFingerprintKey(fingerprint), timestampMs)
            .apply()

        pruneProcessedFingerprints(timestampMs)
    }

    fun isRecentDuplicate(fingerprint: String, windowMs: Long = 120_000L): Boolean {
        val now = System.currentTimeMillis()

        // Nouveau mécanisme: un timestamp par fingerprint. Contrairement à
        // l'ancien "dernier fingerprint", il reste correct si plusieurs SMS
        // sont traités en parallèle ou dans un ordre différent.
        val processedAt = prefs.getLong(processedFingerprintKey(fingerprint), 0L)
        if (processedAt > 0L && (now - processedAt) in 0..windowMs) {
            return true
        }

        // Compatibilité avec une installation provenant d'une ancienne APK.
        val lastFingerprint = prefs.getString("last_inbound_fingerprint", null)
        val lastTimestamp = prefs.getLong("last_inbound_timestamp", 0L)
        return lastFingerprint == fingerprint && (now - lastTimestamp) in 0..windowMs
    }

    private fun processedFingerprintKey(fingerprint: String): String =
        "processed_inbound_fp_$fingerprint"

    private fun pruneProcessedFingerprints(nowMs: Long) {
        val expiry = nowMs - 24L * 60L * 60L * 1000L
        val editor = prefs.edit()
        var changed = false

        prefs.all.forEach { (key, value) ->
            if (!key.startsWith("processed_inbound_fp_")) return@forEach
            val timestamp = value as? Long ?: return@forEach
            if (timestamp < expiry) {
                editor.remove(key)
                changed = true
            }
        }

        if (changed) editor.apply()
    }

    private fun buildWebhookUrl(
        hostInput: String,
        portInput: String,
        portEnabled: Boolean
    ): String {
        val normalizedInput = normalizeHostInput(hostInput)
        val uri = try {
            URI(normalizedInput)
        } catch (_: Exception) {
            URI("http://${Env.DEFAULT_BACKEND_HOST}")
        }

        val scheme = uri.scheme?.ifBlank { "http" } ?: "http"
        val host = uri.host
            ?: normalizedInput.substringAfter("://", normalizedInput)
                .substringBefore("/")
                .substringBefore(":")
                .ifBlank { Env.DEFAULT_BACKEND_HOST }

        val port = sanitizePortForStorage(portInput)
        val portPart = if (portEnabled && port.isNotBlank()) ":$port" else ""

        val basePath = (uri.rawPath ?: "")
            .removeSuffix(Env.WEBHOOK_PATH.trimEnd('/'))
            .trim('/')

        val finalPath = joinPaths(basePath, Env.WEBHOOK_PATH)

        return "$scheme://$host$portPart$finalPath"
    }

    private fun normalizeHostInput(value: String): String {
        var host = value.trim().ifBlank { Env.DEFAULT_BACKEND_HOST }

        if (!host.startsWith("http://") && !host.startsWith("https://")) {
            host = "http://$host"
        }

        return host.trimEnd('/')
    }

    private fun sanitizeHostForStorage(value: String): String {
        return value.trim()
            .removeSuffix(Env.WEBHOOK_PATH.trimEnd('/'))
            .trimEnd('/')
            .ifBlank { Env.DEFAULT_BACKEND_HOST }
    }

    private fun sanitizePortForStorage(value: String): String {
        val port = value.trim().toIntOrNull()

        return if (port != null && port in 1..65535) {
            port.toString()
        } else {
            Env.DEFAULT_BACKEND_PORT.toString()
        }
    }

    private fun joinPaths(basePath: String, childPath: String): String {
        val cleanBase = basePath.trim('/')
        val cleanChild = childPath.trim('/')

        return if (cleanBase.isBlank()) {
            "/$cleanChild/"
        } else {
            "/$cleanBase/$cleanChild/"
        }
    }
}

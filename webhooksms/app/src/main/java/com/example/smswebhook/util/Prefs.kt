package com.example.smswebhook.util

import android.content.Context
import android.content.SharedPreferences
import java.security.MessageDigest
import kotlin.math.abs

/**
 * Etat technique de l'application SMS autonome.
 *
 * Les noms de certaines clés SharedPreferences sont volontairement conservés pour
 * qu'une installation provenant de l'ancienne APK ne perde pas ses réglages.
 * Aucune de ces préférences ne contient une URL de backend ou un serveur distant.
 */
class Prefs(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("sms_webhook_prefs", Context.MODE_PRIVATE)

    private val broadcastMarkerRetentionMs = 24L * 60L * 60L * 1000L
    private val maxBroadcastMarkersPerContent = 20

    fun saveLastSmsId(id: Long) = prefs.edit().putLong("last_sms_id", id).apply()
    fun getLastSmsId(): Long = prefs.getLong("last_sms_id", 0L)


    /** Interrupteur maître de toute l'application. */
    fun setApplicationEnabled(enabled: Boolean) {
        val editor = prefs.edit().putBoolean("application_enabled", enabled)
        if (!enabled) editor.putBoolean("inbound_resume_baseline_required", true)
        editor.apply()
    }

    fun isApplicationEnabled(): Boolean =
        prefs.getBoolean("application_enabled", true)

    /** Active/désactive la chaîne SMS entrant -> Gemini -> SMS sortant. */
    fun setAutoReplyAssistantEnabled(enabled: Boolean) {
        // Clé historique conservée pour migration transparente depuis l'ancienne APK.
        val editor = prefs.edit().putBoolean("auto_reply_webhook_enabled", enabled)
        if (!enabled) editor.putBoolean("inbound_resume_baseline_required", true)
        editor.apply()
    }

    fun isAutoReplyAssistantEnabled(): Boolean =
        prefs.getBoolean("auto_reply_webhook_enabled", true)

    fun isAutoReplyAssistantActive(): Boolean =
        isApplicationEnabled() && isAutoReplyAssistantEnabled()

    fun isInboundResumeBaselineRequired(): Boolean =
        prefs.getBoolean("inbound_resume_baseline_required", false)

    fun clearInboundResumeBaselineRequired() {
        prefs.edit().putBoolean("inbound_resume_baseline_required", false).apply()
    }

    /**
     * Enregistre une occurrence capturée par SMS_RECEIVED. Plusieurs SMS ayant le
     * même texte restent des événements distincts (ex. deux "CONFIRMER").
     */
    @Synchronized
    fun rememberBroadcastInbound(address: String, body: String, sourceTimestampMs: Long) {
        val digest = inboundContentDigest(address, body)
        val now = System.currentTimeMillis()
        val key = "broadcast_inbound_markers_$digest"
        val markers = readBroadcastMarkers(key)
            .filter { now - it.second in 0..broadcastMarkerRetentionMs }
            .toMutableList()

        markers.add(sourceTimestampMs to now)
        while (markers.size > maxBroadcastMarkersPerContent) markers.removeAt(0)

        prefs.edit().putString(key, encodeBroadcastMarkers(markers)).apply()
        pruneBroadcastInboundMarkers(now)
    }

    /**
     * Consomme une capture Broadcast correspondant à la ligne Inbox. Cela évite
     * de traiter deux fois un même SMS sans bloquer les vrais doublons ultérieurs.
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
            val fresh = now - marker.second in 0..broadcastMarkerRetentionMs
            fresh && index != bestIndex
        }

        val editor = prefs.edit()
        if (kept.isEmpty()) editor.remove(key)
        else editor.putString(key, encodeBroadcastMarkers(kept))
        editor.apply()

        return bestIndex >= 0
    }

    private fun inboundContentDigest(address: String, body: String): String {
        val normalizedAddress = address.replace("\\s+".toRegex(), "").replace("-", "").trim()
        val normalizedBody = body.trim().replace("\\s+".toRegex(), " ")
        val raw = "$normalizedAddress|$normalizedBody"
        val bytes = MessageDigest.getInstance("SHA-256").digest(raw.toByteArray(Charsets.UTF_8))
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
                .filter { nowMs - it.second in 0..broadcastMarkerRetentionMs }
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

    fun saveLastGeminiResponseAt(timestampMs: Long) =
        prefs.edit().putLong("last_inbound_gemini_at", timestampMs).apply()

    fun getLastGeminiResponseAt(): Long {
        val current = prefs.getLong("last_inbound_gemini_at", 0L)
        if (current > 0L) return current
        // Migration visuelle de l'ancienne version uniquement.
        return prefs.getLong("last_inbound_backend_at", 0L)
    }

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
        val processedAt = prefs.getLong(processedFingerprintKey(fingerprint), 0L)
        if (processedAt > 0L && (now - processedAt) in 0..windowMs) return true

        // Compatibilité avec une installation provenant de l'ancienne APK.
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
}

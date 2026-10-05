package com.example.smswebhook.ai

import android.content.Context
import com.example.smswebhook.util.Env
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

class ConversationStore(context: Context) {
    data class Turn(val role: String, val text: String)

    private val prefs = context.getSharedPreferences("terra_nova_ai_conversations", Context.MODE_PRIVATE)

    @Synchronized
    fun getHistory(sender: String): List<Turn> {
        val raw = prefs.getString(historyKey(sender), "[]").orEmpty()
        val arr = runCatching { JSONArray(raw) }.getOrElse { JSONArray() }
        val turns = mutableListOf<Turn>()
        for (i in 0 until arr.length()) {
            val item = arr.optJSONObject(i) ?: continue
            val role = item.optString("role").trim()
            val text = item.optString("text").trim()
            if (role in setOf("user", "model") && text.isNotBlank()) {
                turns += Turn(role, text)
            }
        }
        return turns.takeLast(Env.MAX_HISTORY_TURNS)
    }

    @Synchronized
    fun appendExchange(sender: String, userText: String, modelText: String) {
        val turns = getHistory(sender).toMutableList()
        turns += Turn("user", userText.trim())
        turns += Turn("model", modelText.trim())
        val kept = turns.takeLast(Env.MAX_HISTORY_TURNS)
        val arr = JSONArray()
        kept.forEach { turn ->
            arr.put(JSONObject().put("role", turn.role).put("text", turn.text))
        }
        prefs.edit().putString(historyKey(sender), arr.toString()).apply()
    }

    @Synchronized
    fun getState(sender: String): JSONObject {
        val raw = prefs.getString(stateKey(sender), "{}").orEmpty()
        return runCatching { JSONObject(raw) }.getOrElse { JSONObject() }
    }

    @Synchronized
    fun saveState(sender: String, state: JSONObject) {
        prefs.edit().putString(stateKey(sender), state.toString()).apply()
    }

    @Synchronized
    fun clearDraft(sender: String) {
        prefs.edit().remove(stateKey(sender)).apply()
    }

    @Synchronized
    fun resetConversation(sender: String) {
        prefs.edit().remove(historyKey(sender)).remove(stateKey(sender)).apply()
    }

    @Synchronized
    fun clearAllConversations() {
        prefs.edit().clear().apply()
    }

    @Synchronized
    fun createLocalRecord(sender: String, workflow: String, draft: JSONObject): String {
        val ref = makeReference(workflow)
        val records = readRecords(sender)
        val record = JSONObject()
            .put("reference", ref)
            .put("workflow", workflow)
            .put("status", "local_received")
            .put("created_at", isoNow())
            .put("draft", JSONObject(draft.toString()))
        records.put(record)

        val trimmed = JSONArray()
        val start = (records.length() - Env.MAX_LOCAL_RECORDS_PER_SENDER).coerceAtLeast(0)
        for (i in start until records.length()) trimmed.put(records.get(i))
        prefs.edit().putString(recordsKey(sender), trimmed.toString()).apply()
        return ref
    }

    @Synchronized
    fun recordsContext(sender: String): String {
        val records = readRecords(sender)
        val result = JSONArray()
        val start = (records.length() - 10).coerceAtLeast(0)
        for (i in start until records.length()) result.put(records.get(i))
        return result.toString()
    }

    private fun readRecords(sender: String): JSONArray {
        val raw = prefs.getString(recordsKey(sender), "[]").orEmpty()
        return runCatching { JSONArray(raw) }.getOrElse { JSONArray() }
    }

    private fun makeReference(workflow: String): String {
        val prefix = when (workflow) {
            "appointment" -> "NT-L-A"
            "contact" -> "NT-L-C"
            "privacy" -> "NT-L-PRIV"
            "idea" -> "NT-L-IDEA"
            "project_participation", "project_support" -> "NT-L-PART"
            "service_feedback" -> "NT-L-FDB"
            else -> "NT-L-R"
        }
        return "$prefix-${UUID.randomUUID().toString().replace("-", "").take(6).uppercase(Locale.ROOT)}"
    }

    private fun historyKey(sender: String) = "history_${senderId(sender)}"
    private fun stateKey(sender: String) = "state_${senderId(sender)}"
    private fun recordsKey(sender: String) = "records_${senderId(sender)}"

    private fun senderId(sender: String): String {
        val normalized = sender.replace("\\s+".toRegex(), "").replace("-", "").trim()
        val bytes = MessageDigest.getInstance("SHA-256").digest(normalized.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }.take(32)
    }

    private fun isoNow(): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.ROOT).format(Date())
}

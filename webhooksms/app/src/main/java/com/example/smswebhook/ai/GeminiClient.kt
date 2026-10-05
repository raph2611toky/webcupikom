package com.example.smswebhook.ai

import com.example.smswebhook.util.Env
import com.example.smswebhook.util.HttpClient
import org.json.JSONArray
import org.json.JSONObject

class GeminiClient(private val settings: AssistantSettings) {

    suspend fun generate(
        systemPrompt: String,
        history: List<ConversationStore.Turn>,
        currentMessage: String
    ): String {
        val apiKey = settings.getApiKey()
        require(apiKey.isNotBlank()) { "Clé API Gemini non configurée" }

        val contents = JSONArray()
        history.forEach { turn ->
            contents.put(
                JSONObject()
                    .put("role", turn.role)
                    .put("parts", JSONArray().put(JSONObject().put("text", turn.text)))
            )
        }
        contents.put(
            JSONObject()
                .put("role", "user")
                .put("parts", JSONArray().put(JSONObject().put("text", currentMessage)))
        )

        val payload = JSONObject()
            .put(
                "systemInstruction",
                JSONObject().put(
                    "parts",
                    JSONArray().put(JSONObject().put("text", systemPrompt))
                )
            )
            .put("contents", contents)
            .put(
                "generationConfig",
                JSONObject()
                    .put("temperature", 0.2)
                    .put("maxOutputTokens", 900)
                    .put("responseMimeType", "application/json")
            )

        val model = settings.getModel()
        val url = "${Env.GEMINI_API_BASE}/$model:generateContent"
        val response = HttpClient.postJson(
            url = url,
            data = payload,
            headers = mapOf(
                "x-goog-api-key" to apiKey,
                "Accept" to "application/json"
            )
        )

        if (!response.optBoolean("_http_success", true)) {
            val error = response.optJSONObject("error")
            val message = error?.optString("message")
                ?.takeIf { it.isNotBlank() }
                ?: "HTTP ${response.optInt("_http_status", 0)}"
            throw IllegalStateException("Gemini: $message")
        }

        val candidates = response.optJSONArray("candidates")
            ?: throw IllegalStateException("Gemini n'a renvoyé aucun candidat")
        val candidate = candidates.optJSONObject(0)
            ?: throw IllegalStateException("Réponse Gemini vide")
        val parts = candidate.optJSONObject("content")?.optJSONArray("parts")
            ?: throw IllegalStateException("Contenu Gemini absent")

        val text = buildString {
            for (i in 0 until parts.length()) {
                val value = parts.optJSONObject(i)?.optString("text").orEmpty()
                if (value.isNotBlank()) append(value)
            }
        }.trim()

        if (text.isBlank()) throw IllegalStateException("Gemini a renvoyé une réponse vide")
        return text
    }
}

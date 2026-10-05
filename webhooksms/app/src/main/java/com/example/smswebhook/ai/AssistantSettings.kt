package com.example.smswebhook.ai

import android.content.Context
import com.example.smswebhook.BuildConfig
import com.example.smswebhook.util.Env

class AssistantSettings(context: Context) {
    private val prefs = context.getSharedPreferences("terra_nova_ai_settings", Context.MODE_PRIVATE)

    fun getApiKey(): String {
        val override = prefs.getString("gemini_api_key", "").orEmpty().trim()
        return override.ifBlank { BuildConfig.GEMINI_API_KEY.trim() }
    }

    fun getModel(): String = prefs.getString("gemini_model", Env.DEFAULT_GEMINI_MODEL)
        .orEmpty().trim().ifBlank { Env.DEFAULT_GEMINI_MODEL }

    fun save(apiKey: String, model: String) {
        prefs.edit()
            .putString("gemini_api_key", apiKey.trim())
            .putString("gemini_model", model.trim().ifBlank { Env.DEFAULT_GEMINI_MODEL })
            .apply()
    }

    fun isConfigured(): Boolean = getApiKey().isNotBlank()

    fun maskedKey(): String {
        val key = getApiKey()
        if (key.isBlank()) return "non configurée"
        if (key.length <= 8) return "••••••••"
        return "${key.take(4)}••••${key.takeLast(4)}"
    }
}

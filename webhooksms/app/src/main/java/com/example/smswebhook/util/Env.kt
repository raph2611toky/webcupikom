package com.example.smswebhook.util

object Env {
    const val GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
    const val DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"

    const val CONNECT_TIMEOUT_SECONDS = 20L
    const val READ_TIMEOUT_SECONDS = 45L
    const val WRITE_TIMEOUT_SECONDS = 30L

    const val MAX_HISTORY_TURNS = 14
    const val MAX_LOCAL_RECORDS_PER_SENDER = 20
    const val MAX_SMS_REPLY_CHARS = 1200

}

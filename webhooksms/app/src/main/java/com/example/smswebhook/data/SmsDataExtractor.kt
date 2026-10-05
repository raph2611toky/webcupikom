package com.example.smswebhook.data

import android.content.Intent
import android.provider.Telephony
import android.telephony.SmsMessage
import android.util.Log

data class IncomingSms(
    val address: String,
    val body: String,
    val timestamp: Long,
    val subscriptionId: Int
)

class SmsDataExtractor {

    fun extractIncomingSms(intent: Intent): IncomingSms? {
        return try {
            val messages: Array<SmsMessage> = Telephony.Sms.Intents.getMessagesFromIntent(intent)

            if (messages.isEmpty()) {
                Log.w(TAG, "Aucun SmsMessage extrait depuis l'intent")
                return null
            }

            val first = messages.first()

            val address = normalizePhone(
                first.displayOriginatingAddress
                    ?: first.originatingAddress
                    ?: ""
            )

            val body = messages.joinToString(separator = "") { sms ->
                sms.displayMessageBody ?: sms.messageBody ?: ""
            }.trim()

            if (address.isBlank() || body.isBlank()) {
                Log.w(TAG, "SMS entrant invalide: address='$address', body vide=${body.isBlank()}")
                return null
            }

            val timestamp = if (first.timestampMillis > 0) {
                first.timestampMillis
            } else {
                System.currentTimeMillis()
            }

            val subscriptionId = extractSubscriptionId(intent)

            IncomingSms(
                address = address,
                body = body,
                timestamp = timestamp,
                subscriptionId = subscriptionId
            )
        } catch (e: Exception) {
            Log.e(TAG, "Erreur extraction SMS: ${e.message}", e)
            null
        }
    }

    private fun extractSubscriptionId(intent: Intent): Int {
        val candidateKeys = listOf(
            "subscription",
            "subscription_id",
            "android.telephony.extra.SUBSCRIPTION_INDEX"
        )

        for (key in candidateKeys) {
            val value = intent.getIntExtra(key, Int.MIN_VALUE)
            if (value != Int.MIN_VALUE) {
                return value
            }
        }
        return -1
    }

    private fun normalizePhone(number: String): String {
        return number
            .replace("\\s+".toRegex(), "")
            .replace("-", "")
            .trim()
    }

    companion object {
        private const val TAG = "SmsDataExtractor"
    }
}

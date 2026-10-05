package com.example.smswebhook.worker

import android.content.Context
import android.os.Build
import android.telephony.SmsManager
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.example.smswebhook.ai.TerraNovaAssistant
import com.example.smswebhook.util.Prefs
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

class IncomingSmsWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    private val prefs = Prefs(appContext)
    private val assistant = TerraNovaAssistant(appContext)

    override suspend fun doWork(): Result {
        if (!prefs.isAutoReplyAssistantActive()) {
            Log.i(TAG, "Worker ignoré: assistant SMS désactivé")
            return Result.success()
        }

        val address = inputData.getString(KEY_ADDRESS).orEmpty().trim()
        val body = inputData.getString(KEY_BODY).orEmpty().trim()
        val timestamp = inputData.getLong(KEY_TIMESTAMP, System.currentTimeMillis())
        val subscriptionId = inputData.getInt(KEY_SUBSCRIPTION_ID, -1)
        val fingerprint = inputData.getString(KEY_FINGERPRINT)
            ?: fingerprint(address, body, timestamp)

        if (address.isBlank() || body.isBlank()) {
            Log.e(TAG, "Worker abandonné: numéro ou contenu SMS vide")
            return Result.failure()
        }

        if (prefs.isRecentDuplicate(fingerprint, DUPLICATE_WINDOW_MS)) {
            Log.i(TAG, "SMS déjà traité; aucun doublon")
            return Result.success()
        }

        Log.i(TAG, "SMS Terra Nova reçu de $address; appel Gemini local Android")

        val reply = try {
            assistant.handle(address, body).reply.trim()
        } catch (e: IllegalArgumentException) {
            Log.e(TAG, "Configuration IA invalide: ${e.message}", e)
            return Result.failure()
        } catch (e: Exception) {
            Log.w(TAG, "Gemini temporairement inaccessible; retry WorkManager: ${e.message}")
            return Result.retry()
        }

        if (reply.isBlank()) {
            Log.w(TAG, "Assistant Terra Nova sans réponse")
            return Result.retry()
        }

        // L'appel Gemini a abouti : évite qu'une récupération Inbox relance le même tour.
        prefs.saveLastInboundFingerprint(fingerprint, System.currentTimeMillis())
        // Ancien champ conservé pour compatibilité des préférences; il signifie désormais « Gemini atteint ».
        prefs.saveLastGeminiResponseAt(System.currentTimeMillis())

        if (!prefs.isAutoReplyAssistantActive()) {
            Log.i(TAG, "Envoi annulé: assistant SMS désactivé pendant le traitement")
            return Result.success()
        }

        return try {
            sendSms(address, reply, subscriptionId)
            prefs.saveLastInboundReplyAt(System.currentTimeMillis())
            Log.i(TAG, "Réponse Terra Nova envoyée directement par SMS vers $address")
            Result.success()
        } catch (e: Exception) {
            // Ne relance pas Gemini après une réponse déjà générée et mémorisée.
            Log.e(TAG, "Réponse générée mais SmsManager n'a pas pu l'envoyer: ${e.message}", e)
            Result.success()
        }
    }

    @Suppress("DEPRECATION")
    private fun sendSms(phoneNumber: String, message: String, subscriptionId: Int) {
        val smsManager = if (
            subscriptionId != -1 &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1
        ) {
            SmsManager.getSmsManagerForSubscriptionId(subscriptionId)
        } else {
            SmsManager.getDefault()
        }

        val parts = ArrayList(smsManager.divideMessage(message.trim()))
        smsManager.sendMultipartTextMessage(phoneNumber.trim(), null, parts, null, null)
    }

    companion object {
        private const val TAG = "IncomingSmsWorker"

        private const val KEY_ADDRESS = "address"
        private const val KEY_BODY = "body"
        private const val KEY_TIMESTAMP = "timestamp"
        private const val KEY_SUBSCRIPTION_ID = "subscription_id"
        private const val KEY_FINGERPRINT = "fingerprint"

        private const val SENDER_CHAIN_PREFIX = "terra_nova_sms_sender_"
        private const val DUPLICATE_WINDOW_MS = 6 * 60 * 60 * 1000L

        fun enqueue(
            context: Context,
            address: String,
            body: String,
            timestamp: Long,
            subscriptionId: Int
        ): String {
            if (!Prefs(context.applicationContext).isAutoReplyAssistantActive()) {
                Log.i(TAG, "enqueue ignoré: assistant SMS désactivé")
                return "disabled"
            }

            val fingerprint = fingerprint(address, body, timestamp)
            val senderChainName = "$SENDER_CHAIN_PREFIX${senderChainId(address)}"

            val input = Data.Builder()
                .putString(KEY_ADDRESS, address)
                .putString(KEY_BODY, body)
                .putLong(KEY_TIMESTAMP, timestamp)
                .putInt(KEY_SUBSCRIPTION_ID, subscriptionId)
                .putString(KEY_FINGERPRINT, fingerprint)
                .build()

            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<IncomingSmsWorker>()
                .setInputData(input)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .addTag(TAG)
                .build()

            Prefs(context).saveLastInboundCapturedAt(System.currentTimeMillis())

            // Un seul tour à la fois par numéro : l'historique Gemini reste strictement ordonné.
            WorkManager.getInstance(context).enqueueUniqueWork(
                senderChainName,
                ExistingWorkPolicy.APPEND_OR_REPLACE,
                request
            )

            return request.id.toString()
        }

        fun cancelAll(context: Context) {
            WorkManager.getInstance(context.applicationContext).cancelAllWorkByTag(TAG)
        }

        private fun senderChainId(address: String): String {
            val normalized = address.replace("\\s+".toRegex(), "").replace("-", "").trim()
            val bytes = MessageDigest.getInstance("SHA-256")
                .digest(normalized.toByteArray(Charsets.UTF_8))
            return bytes.joinToString("") { "%02x".format(it) }.take(32)
        }

        private fun fingerprint(address: String, body: String, timestamp: Long): String {
            val raw = "$address|$body|$timestamp"
            val bytes = MessageDigest.getInstance("SHA-256")
                .digest(raw.toByteArray(Charsets.UTF_8))
            return bytes.joinToString("") { "%02x".format(it) }
        }
    }
}

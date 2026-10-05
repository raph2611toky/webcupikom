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
import com.example.smswebhook.util.Env
import com.example.smswebhook.util.HttpClient
import com.example.smswebhook.util.Prefs
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

class IncomingSmsWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    private val prefs = Prefs(appContext)

    override suspend fun doWork(): Result {
        if (!prefs.isAutoReplyWebhookActive()) {
            Log.i(TAG, "Worker ignoré: application ou webhook automatique désactivé")
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

        Log.i(
            TAG,
            "Traitement SMS persistant: tentative WorkManager=${runAttemptCount + 1}, destination=${prefs.getWebhookUrl()}"
        )

        // Si la même diffusion système a été reçue deux fois, une seule requête part.
        if (prefs.isRecentDuplicate(fingerprint, DUPLICATE_WINDOW_MS)) {
            Log.i(TAG, "SMS déjà traité; worker terminé sans doublon")
            return Result.success()
        }

        val payload = JSONObject().apply {
            put("address", address)
            put("body", body)
            put("msg_type", "sms")
            put("date", timestamp)
            put("direction", "inbound")
            put("subscription_id", subscriptionId)
            // Référence stable du job Android. Django peut l'utiliser directement
            // pour rendre un retry WorkManager strictement idempotent.
            put("client_reference", fingerprint)
        }

        val headers = buildMap {
            if (Env.WEBHOOK_TOKEN.isNotBlank()) {
                put("x-webhook-token", Env.WEBHOOK_TOKEN)
            }
        }

        val response = try {
            postToBackendWithShortRetry(
                url = prefs.getWebhookUrl(),
                payload = payload,
                headers = headers
            )
        } catch (e: Exception) {
            Log.w(
                TAG,
                "Backend temporairement inaccessible; WorkManager reprogrammera le SMS: ${e.message}"
            )
            return Result.retry()
        }

        /*
         * On marque comme traité uniquement après une vraie réponse HTTP.
         * Si le réseau/process meurt avant, WorkManager pourra rejouer le job.
         */
        prefs.saveLastInboundFingerprint(fingerprint, System.currentTimeMillis())
        prefs.saveLastInboundBackendAt(System.currentTimeMillis())

        val httpStatus = response.optInt("_http_status", 200)
        val httpSuccess = response.optBoolean("_http_success", true)
        val reply = response.optString("reply", "").trim()

        if (!httpSuccess) {
            Log.w(
                TAG,
                "Backend HTTP $httpStatus: ${response.optString("message", response.toString())}"
            )
        }

        if (reply.isBlank()) {
            Log.i(TAG, "Backend atteint; aucune réponse SMS à renvoyer")
            return Result.success()
        }

        if (!prefs.isAutoReplyWebhookActive()) {
            Log.i(TAG, "Réponse SMS annulée: webhook automatique désactivé pendant le traitement")
            return Result.success()
        }

        return try {
            sendSms(
                phoneNumber = address,
                message = reply,
                subscriptionId = subscriptionId
            )
            prefs.saveLastInboundReplyAt(System.currentTimeMillis())
            Log.i(TAG, "Réponse SMS envoyée vers $address")
            Result.success()
        } catch (e: Exception) {
            /*
             * Le backend a déjà traité le SMS et le fingerprint est enregistré.
             * Ne surtout pas rejouer le backend à cause d'un échec SmsManager,
             * sinon une action métier pourrait être exécutée deux fois.
             */
            Log.e(TAG, "Backend traité mais réponse SMS locale non envoyée: ${e.message}", e)
            Result.success()
        }
    }

    private suspend fun postToBackendWithShortRetry(
        url: String,
        payload: JSONObject,
        headers: Map<String, String>
    ): JSONObject {
        var lastError: Exception? = null

        SHORT_RETRY_DELAYS_MS.forEachIndexed { index, waitMs ->
            if (waitMs > 0) delay(waitMs)

            try {
                Log.i(TAG, "HTTP backend tentative locale ${index + 1}/${SHORT_RETRY_DELAYS_MS.size}")
                return HttpClient.postJson(url, payload, headers)
            } catch (e: Exception) {
                lastError = e
                Log.w(TAG, "HTTP backend tentative ${index + 1} échouée: ${e.message}")
            }
        }

        throw lastError ?: IllegalStateException("Échec HTTP backend")
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
        smsManager.sendMultipartTextMessage(
            phoneNumber.trim(),
            null,
            parts,
            null,
            null
        )
    }

    companion object {
        private const val TAG = "IncomingSmsWorker"

        private const val KEY_ADDRESS = "address"
        private const val KEY_BODY = "body"
        private const val KEY_TIMESTAMP = "timestamp"
        private const val KEY_SUBSCRIPTION_ID = "subscription_id"
        private const val KEY_FINGERPRINT = "fingerprint"

        private const val UNIQUE_PREFIX = "incoming_sms_"
        private const val SENDER_CHAIN_PREFIX = "incoming_sms_sender_"
        private const val DUPLICATE_WINDOW_MS = 6 * 60 * 60 * 1000L

        // Courts retries immédiats; WorkManager prend ensuite le relais durablement.
        private val SHORT_RETRY_DELAYS_MS = longArrayOf(0L, 1_500L)

        fun enqueue(
            context: Context,
            address: String,
            body: String,
            timestamp: Long,
            subscriptionId: Int
        ): String {
            if (!Prefs(context.applicationContext).isAutoReplyWebhookActive()) {
                Log.i(TAG, "enqueue ignoré: webhook automatique désactivé")
                return "disabled"
            }

            val fingerprint = fingerprint(address, body, timestamp)
            val uniqueName = "$UNIQUE_PREFIX$fingerprint"
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
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    10,
                    TimeUnit.SECONDS
                )
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .addTag(TAG)
                .addTag(uniqueName)
                .build()

            Prefs(context).saveLastInboundCapturedAt(System.currentTimeMillis())

            /*
             * Un seul flux séquentiel par numéro : les corrections et CONFIRMER ne
             * peuvent plus dépasser un SMS précédent encore en cours côté backend.
             * APPEND_OR_REPLACE évite qu'un ancien worker FAILED bloque définitivement
             * les nouveaux messages de ce même utilisateur.
             */
            WorkManager.getInstance(context).enqueueUniqueWork(
                senderChainName,
                ExistingWorkPolicy.APPEND_OR_REPLACE,
                request
            )

            return request.id.toString()
        }


        fun cancelAll(context: Context) {
            WorkManager.getInstance(context.applicationContext)
                .cancelAllWorkByTag(TAG)
        }

        private fun senderChainId(address: String): String {
            val normalized = address
                .replace("\\s+".toRegex(), "")
                .replace("-", "")
                .trim()
            val bytes = MessageDigest.getInstance("SHA-256")
                .digest(normalized.toByteArray(Charsets.UTF_8))
            return bytes.joinToString("") { "%02x".format(it) }.take(32)
        }

        private fun fingerprint(
            address: String,
            body: String,
            timestamp: Long
        ): String {
            // Le subscriptionId est volontairement exclu: une récupération
            // depuis la boîte SMS et le BroadcastReceiver doivent produire le
            // même identifiant même si la ROM expose différemment la SIM.
            val raw = "$address|$body|$timestamp"
            val bytes = MessageDigest.getInstance("SHA-256")
                .digest(raw.toByteArray(Charsets.UTF_8))
            return bytes.joinToString("") { "%02x".format(it) }
        }
    }
}

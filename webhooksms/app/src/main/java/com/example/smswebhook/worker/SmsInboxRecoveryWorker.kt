package com.example.smswebhook.worker

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.BaseColumns
import android.provider.Telephony
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.example.smswebhook.util.Prefs
import java.util.concurrent.TimeUnit

/**
 * Filet de sécurité contre les ROM OEM qui omettent ponctuellement un
 * SMS_RECEIVED. Le chemin normal reste le BroadcastReceiver immédiat.
 *
 * Ce worker relit uniquement les nouveaux éléments de content://sms/inbox et
 * les remet dans IncomingSmsWorker. Le fingerprint commun empêche les doublons.
 */
class SmsInboxRecoveryWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val context = applicationContext
        val prefs = Prefs(context)

        if (!prefs.isAutoReplyAssistantActive()) {
            Log.i(TAG, "Récupération inbox ignorée: application ou assistant automatique désactivé")
            return Result.success()
        }

        if (!hasReadSmsPermission(context)) {
            Log.w(TAG, "Récupération inbox ignorée: READ_SMS non accordée")
            return Result.success()
        }

        var lastId = prefs.getLastSmsId()

        if (lastId <= 0L) {
            initializeBaselineIfNeeded(context)
            Log.i(TAG, "Baseline inbox initialisée; aucun ancien SMS rejoué")
            return Result.success()
        }

        return try {
            val projection = arrayOf(
                BaseColumns._ID,
                Telephony.TextBasedSmsColumns.ADDRESS,
                Telephony.TextBasedSmsColumns.BODY,
                Telephony.TextBasedSmsColumns.DATE,
                Telephony.TextBasedSmsColumns.SUBSCRIPTION_ID
            )

            context.contentResolver.query(
                Telephony.Sms.Inbox.CONTENT_URI,
                projection,
                "${BaseColumns._ID} > ?",
                arrayOf(lastId.toString()),
                "${BaseColumns._ID} ASC"
            )?.use { cursor ->
                val idIndex = cursor.getColumnIndexOrThrow(BaseColumns._ID)
                val addressIndex = cursor.getColumnIndexOrThrow(Telephony.TextBasedSmsColumns.ADDRESS)
                val bodyIndex = cursor.getColumnIndexOrThrow(Telephony.TextBasedSmsColumns.BODY)
                val dateIndex = cursor.getColumnIndexOrThrow(Telephony.TextBasedSmsColumns.DATE)
                val subIndex = cursor.getColumnIndex(Telephony.TextBasedSmsColumns.SUBSCRIPTION_ID)

                var recovered = 0
                while (cursor.moveToNext() && recovered < MAX_RECOVERY_PER_RUN) {
                    val id = cursor.getLong(idIndex)
                    val address = normalizePhone(cursor.getString(addressIndex).orEmpty())
                    val body = cursor.getString(bodyIndex).orEmpty().trim()
                    val timestamp = cursor.getLong(dateIndex)
                    val subscriptionId = if (subIndex >= 0) cursor.getInt(subIndex) else -1

                    if (address.isNotBlank() && body.isNotBlank()) {
                        if (prefs.consumeBroadcastCapture(address, body, timestamp)) {
                            Log.i(
                                TAG,
                                "Inbox SMS id=$id déjà capturé par SMS_RECEIVED; replay ignoré"
                            )
                        } else {
                            IncomingSmsWorker.enqueue(
                                context = context,
                                address = address,
                                body = body,
                                timestamp = timestamp,
                                subscriptionId = subscriptionId
                            )
                            recovered += 1
                        }
                    }

                    // enqueueUniqueWork persiste avant qu'on avance le curseur.
                    lastId = maxOf(lastId, id)
                    prefs.saveLastSmsId(lastId)
                }

                if (recovered > 0) {
                    Log.w(TAG, "Récupération inbox: $recovered SMS remis dans la file persistante")
                }
            }

            Result.success()
        } catch (e: SecurityException) {
            Log.e(TAG, "Accès inbox SMS refusé: ${e.message}", e)
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Erreur récupération inbox SMS: ${e.message}", e)
            Result.retry()
        }
    }

    companion object {
        private const val TAG = "SmsInboxRecovery"
        private const val UNIQUE_NOW = "sms_inbox_recovery_now"
        private const val UNIQUE_PERIODIC = "sms_inbox_recovery_periodic"
        private const val MAX_RECOVERY_PER_RUN = 100

        fun advanceBaselineToLatest(context: Context): Boolean {
            if (!hasReadSmsPermission(context)) return false

            return try {
                context.contentResolver.query(
                    Telephony.Sms.Inbox.CONTENT_URI,
                    arrayOf(BaseColumns._ID),
                    null,
                    null,
                    "${BaseColumns._ID} DESC"
                )?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        Prefs(context.applicationContext).saveLastSmsId(cursor.getLong(0))
                    }
                }
                true
            } catch (e: Exception) {
                Log.w(TAG, "Impossible d'avancer la baseline inbox: ${e.message}")
                false
            }
        }

        fun initializeBaselineIfNeeded(context: Context) {
            if (!hasReadSmsPermission(context)) return

            val prefs = Prefs(context)
            if (prefs.getLastSmsId() > 0L) return

            try {
                context.contentResolver.query(
                    Telephony.Sms.Inbox.CONTENT_URI,
                    arrayOf(BaseColumns._ID),
                    null,
                    null,
                    "${BaseColumns._ID} DESC"
                )?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        prefs.saveLastSmsId(cursor.getLong(0))
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Impossible d'initialiser la baseline inbox: ${e.message}")
            }
        }

        fun enqueueNow(context: Context) {
            if (!Prefs(context.applicationContext).isAutoReplyAssistantActive()) return

            val request = OneTimeWorkRequestBuilder<SmsInboxRecoveryWorker>()
                .addTag(UNIQUE_NOW)
                .build()

            WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
                UNIQUE_NOW,
                ExistingWorkPolicy.KEEP,
                request
            )
        }

        fun schedulePeriodic(context: Context) {
            if (!Prefs(context.applicationContext).isAutoReplyAssistantActive()) {
                cancelAll(context)
                return
            }

            val request = PeriodicWorkRequestBuilder<SmsInboxRecoveryWorker>(
                15,
                TimeUnit.MINUTES
            )
                .addTag(UNIQUE_PERIODIC)
                .build()

            WorkManager.getInstance(context.applicationContext).enqueueUniquePeriodicWork(
                UNIQUE_PERIODIC,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        fun cancelAll(context: Context) {
            val workManager = WorkManager.getInstance(context.applicationContext)
            workManager.cancelUniqueWork(UNIQUE_NOW)
            workManager.cancelUniqueWork(UNIQUE_PERIODIC)
            workManager.cancelAllWorkByTag(UNIQUE_NOW)
            workManager.cancelAllWorkByTag(UNIQUE_PERIODIC)
        }

        private fun hasReadSmsPermission(context: Context): Boolean =
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_SMS
            ) == PackageManager.PERMISSION_GRANTED

        private fun normalizePhone(value: String): String =
            value.replace("\\s+".toRegex(), "")
                .replace("-", "")
                .trim()
    }
}

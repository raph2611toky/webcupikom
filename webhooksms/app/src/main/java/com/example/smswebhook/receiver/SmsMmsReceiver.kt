package com.example.smswebhook.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.example.smswebhook.data.SmsDataExtractor
import com.example.smswebhook.worker.IncomingSmsWorker
import com.example.smswebhook.util.Prefs

class SmsMmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            return
        }

        val prefs = Prefs(context.applicationContext)
        if (!prefs.isAutoReplyWebhookActive()) {
            Log.i(TAG, "SMS_RECEIVED ignoré: application ou webhook automatique désactivé")
            return
        }

        try {
            val incomingSms = SmsDataExtractor().extractIncomingSms(intent) ?: return

            /*
             * Ne jamais faire dépendre la réception SMS d'un Service Android
             * vivant en mémoire. Le BroadcastReceiver ne fait qu'extraire le
             * message et le confier à WorkManager.
             *
             * WorkManager persiste la tâche. Si Android/OEM tue le processus
             * juste après onReceive(), le transfert sera repris ensuite.
             */
            val workId = IncomingSmsWorker.enqueue(
                context = context.applicationContext,
                address = incomingSms.address,
                body = incomingSms.body,
                timestamp = incomingSms.timestamp,
                subscriptionId = incomingSms.subscriptionId
            )

            // Important : la date stockée par la ROM dans content://sms/inbox peut
            // différer légèrement de timestampMillis du PDU. Sans ce marqueur, le
            // filet SmsInboxRecovery peut prendre le même SMS pour un nouveau message.
            prefs.rememberBroadcastInbound(
                address = incomingSms.address,
                body = incomingSms.body,
                sourceTimestampMs = incomingSms.timestamp
            )

            Log.i(
                TAG,
                "SMS entrant capturé depuis ${incomingSms.address}; file persistante=$workId"
            )
        } catch (e: Exception) {
            Log.e(TAG, "Erreur BroadcastReceiver SMS: ${e.message}", e)
        }
    }

    companion object {
        private const val TAG = "SmsMmsReceiver"
    }
}

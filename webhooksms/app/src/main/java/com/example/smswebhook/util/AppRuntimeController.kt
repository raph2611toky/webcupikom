package com.example.smswebhook.util

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import com.example.smswebhook.receiver.BootReceiver
import com.example.smswebhook.receiver.SmsMmsReceiver
import com.example.smswebhook.service.SmsSendServerService
import com.example.smswebhook.service.WebhookService
import com.example.smswebhook.worker.IncomingSmsWorker
import com.example.smswebhook.worker.SmsInboxRecoveryWorker

/**
 * Synchronise l'état réel de l'application avec les toggles persistés.
 *
 * - application_enabled = master switch
 * - auto_reply_webhook_enabled = SMS entrant -> Django -> réponse SMS
 * - sms_gateway_enabled = serveur HTTP local Django -> Android
 */
object AppRuntimeController {

    private const val TAG = "AppRuntimeController"

    fun applyState(context: Context) {
        val appContext = context.applicationContext
        val prefs = Prefs(appContext)

        syncManifestReceivers(appContext, prefs)

        if (!prefs.isApplicationEnabled()) {
            stopAllBackgroundWork(appContext)
            Log.i(TAG, "Application désactivée: aucun traitement arrière-plan actif")
            return
        }

        if (prefs.isAutoReplyWebhookEnabled()) {
            if (prefs.isInboundResumeBaselineRequired()) {
                // Ne jamais répondre rétroactivement aux SMS reçus pendant un OFF volontaire.
                if (SmsInboxRecoveryWorker.advanceBaselineToLatest(appContext)) {
                    prefs.clearInboundResumeBaselineRequired()
                }
            }

            SmsInboxRecoveryWorker.initializeBaselineIfNeeded(appContext)
            SmsInboxRecoveryWorker.schedulePeriodic(appContext)
            SmsInboxRecoveryWorker.enqueueNow(appContext)
        } else {
            appContext.stopService(Intent(appContext, WebhookService::class.java))
            SmsInboxRecoveryWorker.cancelAll(appContext)
            IncomingSmsWorker.cancelAll(appContext)
            Log.i(TAG, "Webhook de réponse automatique désactivé")
        }

        if (prefs.isOutboundServerEnabled()) {
            startSmsSendServer(appContext)
        } else {
            appContext.stopService(Intent(appContext, SmsSendServerService::class.java))
            Log.i(TAG, "Serveur local Django -> Android désactivé")
        }
    }

    fun stopAllBackgroundWork(context: Context) {
        val appContext = context.applicationContext

        appContext.stopService(Intent(appContext, SmsSendServerService::class.java))
        appContext.stopService(Intent(appContext, WebhookService::class.java))

        SmsInboxRecoveryWorker.cancelAll(appContext)
        IncomingSmsWorker.cancelAll(appContext)
    }

    fun syncManifestReceivers(context: Context) {
        syncManifestReceivers(context.applicationContext, Prefs(context.applicationContext))
    }

    private fun syncManifestReceivers(context: Context, prefs: Prefs) {
        setComponentEnabled(
            context = context,
            componentClass = BootReceiver::class.java,
            enabled = prefs.isApplicationEnabled()
        )

        setComponentEnabled(
            context = context,
            componentClass = SmsMmsReceiver::class.java,
            enabled = prefs.isAutoReplyWebhookActive()
        )
    }

    private fun startSmsSendServer(context: Context) {
        val intent = Intent(context, SmsSendServerService::class.java).apply {
            putExtra(SmsSendServerService.EXTRA_ENABLE_SERVER, true)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Impossible de démarrer le serveur SMS: ${e.message}", e)
        }
    }

    private fun setComponentEnabled(
        context: Context,
        componentClass: Class<*>,
        enabled: Boolean
    ) {
        try {
            val component = ComponentName(context, componentClass)
            val newState = if (enabled) {
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            } else {
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED
            }

            val currentState = context.packageManager.getComponentEnabledSetting(component)
            if (currentState != newState) {
                context.packageManager.setComponentEnabledSetting(
                    component,
                    newState,
                    PackageManager.DONT_KILL_APP
                )
            }
        } catch (e: Exception) {
            Log.w(
                TAG,
                "Impossible de modifier ${componentClass.simpleName}: ${e.message}"
            )
        }
    }
}

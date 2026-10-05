package com.example.smswebhook.util

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import com.example.smswebhook.receiver.BootReceiver
import com.example.smswebhook.receiver.SmsMmsReceiver
import com.example.smswebhook.worker.IncomingSmsWorker
import com.example.smswebhook.worker.SmsInboxRecoveryWorker

/**
 * Mode autonome Terra Nova : SMS entrant -> Gemini sur Android -> SMS sortant.
 * Aucun serveur HTTP local et aucun backend municipal ne sont nécessaires.
 */
object AppRuntimeController {
    private const val TAG = "AppRuntimeController"

    fun applyState(context: Context) {
        val appContext = context.applicationContext
        val prefs = Prefs(appContext)
        syncManifestReceivers(appContext, prefs)

        if (!prefs.isApplicationEnabled()) {
            stopAllBackgroundWork(appContext)
            Log.i(TAG, "Application désactivée")
            return
        }

        if (prefs.isAutoReplyAssistantEnabled()) {
            if (prefs.isInboundResumeBaselineRequired()) {
                if (SmsInboxRecoveryWorker.advanceBaselineToLatest(appContext)) {
                    prefs.clearInboundResumeBaselineRequired()
                }
            }
            SmsInboxRecoveryWorker.initializeBaselineIfNeeded(appContext)
            SmsInboxRecoveryWorker.schedulePeriodic(appContext)
            SmsInboxRecoveryWorker.enqueueNow(appContext)
        } else {
            SmsInboxRecoveryWorker.cancelAll(appContext)
            IncomingSmsWorker.cancelAll(appContext)
            Log.i(TAG, "Assistant SMS Terra Nova désactivé")
        }
    }

    fun stopAllBackgroundWork(context: Context) {
        val appContext = context.applicationContext
        SmsInboxRecoveryWorker.cancelAll(appContext)
        IncomingSmsWorker.cancelAll(appContext)
    }

    fun syncManifestReceivers(context: Context) {
        syncManifestReceivers(context.applicationContext, Prefs(context.applicationContext))
    }

    private fun syncManifestReceivers(context: Context, prefs: Prefs) {
        setComponentEnabled(context, BootReceiver::class.java, prefs.isApplicationEnabled())
        setComponentEnabled(context, SmsMmsReceiver::class.java, prefs.isAutoReplyAssistantActive())
    }

    private fun setComponentEnabled(context: Context, componentClass: Class<*>, enabled: Boolean) {
        try {
            val component = ComponentName(context, componentClass)
            val newState = if (enabled) {
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            } else {
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED
            }
            if (context.packageManager.getComponentEnabledSetting(component) != newState) {
                context.packageManager.setComponentEnabledSetting(
                    component,
                    newState,
                    PackageManager.DONT_KILL_APP
                )
            }
        } catch (e: Exception) {
            Log.w(TAG, "Impossible de modifier ${componentClass.simpleName}: ${e.message}")
        }
    }
}

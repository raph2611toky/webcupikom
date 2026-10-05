package com.example.smswebhook.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.example.smswebhook.util.AppRuntimeController
import com.example.smswebhook.util.Prefs

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val supportedAction = intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED

        if (!supportedAction) return

        val prefs = Prefs(context.applicationContext)
        if (!prefs.isApplicationEnabled()) {
            Log.i(TAG, "${intent.action}: application désactivée; aucun redémarrage")
            return
        }

        try {
            Log.i(TAG, "${intent.action}: restauration de l'état arrière-plan")
            AppRuntimeController.applyState(context.applicationContext)
        } catch (e: Exception) {
            Log.e(TAG, "Impossible de restaurer l'application au boot/update: ${e.message}", e)
        }
    }

    companion object {
        private const val TAG = "BootReceiver"
    }
}

package com.example.smswebhook

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.example.smswebhook.util.AppRuntimeController
import com.example.smswebhook.util.Env
import com.example.smswebhook.util.NetworkUtils
import com.example.smswebhook.util.Prefs

class MainActivity : AppCompatActivity() {

    private lateinit var statusText: TextView
    private lateinit var urlText: TextView
    private lateinit var timerText: TextView
    private lateinit var settingsButton: Button
    private lateinit var masterToggle: Switch
    private lateinit var autoReplyToggle: Switch
    private var updatingRuntimeToggles = false

    private val handler = Handler(Looper.getMainLooper())
    private var startTime = System.currentTimeMillis()

    private val updateRunnable = object : Runnable {
        override fun run() {
            val prefs = Prefs(this@MainActivity)

            when {
                !prefs.isApplicationEnabled() ->
                    timerText.text = "Application totalement désactivée"

                prefs.isOutboundServerActive() -> {
                    val activeSince = prefs.getOutboundServerEnabledAt()
                        .takeIf { it > 0L }
                        ?: startTime

                    val elapsed = (System.currentTimeMillis() - activeSince) / 1000
                    timerText.text = "Serveur local Django → Android actif : ${elapsed}s"
                }

                else ->
                    timerText.text = "Serveur local Django → Android désactivé"
            }

            refreshRuntimeToggles()
            refreshStatusText(hasRequiredPermissions())
            refreshUrlsText()

            handler.postDelayed(this, 3000)
        }
    }

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            val allGranted = result.values.all { it }

            setupUI(allGranted)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.status_text)
        urlText = findViewById(R.id.url_text)
        timerText = findViewById(R.id.timer_text)
        settingsButton = findViewById(R.id.settings_button)
        installRuntimeTogglePanel()

        settingsButton.setOnClickListener {
            showBackendSettingsDialog()
        }

        if (hasRequiredPermissions()) {
            setupUI(true)
        } else {
            permissionLauncher.launch(requiredPermissions())
        }
    }

    override fun onResume() {
        super.onResume()

        if (::statusText.isInitialized) {
            refreshRuntimeToggles()

            if (hasRequiredPermissions()) {
                // Réarme l'état souhaité sans jamais outrepasser le toggle maître.
                AppRuntimeController.applyState(this)
            }
        }
    }

    private fun setupUI(allGranted: Boolean) {
        refreshStatusText(allGranted)

        val prefs = Prefs(this)
        startTime = prefs.getOutboundServerEnabledAt()
            .takeIf { it > 0L }
            ?: System.currentTimeMillis()

        handler.removeCallbacks(updateRunnable)
        handler.post(updateRunnable)

        if (allGranted) {
            AppRuntimeController.applyState(this)
        }

        refreshRuntimeToggles()
        refreshUrlsText()
    }

    private fun refreshStatusText(allGranted: Boolean) {
        val prefs = Prefs(this)

        statusText.text = when {
            !prefs.isApplicationEnabled() ->
                "APPLICATION : ARRÊTÉE • aucun fonctionnement en arrière-plan"

            !allGranted ->
                "Application active • permissions SMS manquantes"

            prefs.isAutoReplyWebhookEnabled() && prefs.isOutboundServerActive() ->
                "Réponses SMS auto : ACTIVES • Django → Android : ACTIF"

            prefs.isAutoReplyWebhookEnabled() ->
                "Réponses SMS auto : ACTIVES • Django → Android : INACTIF"

            prefs.isOutboundServerActive() ->
                "Réponses SMS auto : INACTIVES • Django → Android : ACTIF"

            else ->
                "Réponses SMS auto : INACTIVES • Django → Android : INACTIF"
        }
    }

    private fun showBackendSettingsDialog() {
        val prefs = Prefs(this)

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(12), dp(20), dp(4))
        }

        val serviceSwitch = Switch(this).apply {
            text = "Activer le serveur local Django → téléphone"
            isChecked = prefs.isOutboundServerEnabled()
            setPadding(0, 0, 0, dp(8))
        }

        val serviceHelpText = TextView(this).apply {
            text =
                "Ce bouton contrôle uniquement le serveur local utilisé par Django pour demander l'envoi d'un SMS. " +
                "Les deux toggles principaux de l'écran contrôlent séparément les réponses automatiques et l'arrêt total."
            setTextColor(Color.DKGRAY)
            textSize = 13f
            setPadding(0, 0, 0, dp(14))
        }

        val batteryText = TextView(this).apply {
            text = if (isIgnoringBatteryOptimizations()) {
                "Batterie : application déjà exemptée des optimisations."
            } else {
                "Batterie : optimisation active. Pour un serveur SMS 24/7, place l'application en mode Non optimisé / Sans restriction."
            }
            setTextColor(if (isIgnoringBatteryOptimizations()) Color.rgb(0, 110, 40) else Color.rgb(180, 90, 0))
            textSize = 13f
            setPadding(0, 0, 0, dp(8))
        }

        val batteryButton = Button(this).apply {
            text = "Ouvrir les réglages d'optimisation batterie"
            isAllCaps = false
            setOnClickListener {
                openBatteryOptimizationSettings()
            }
        }

        val helpText = TextView(this).apply {
            text = "Définis ici la destination du backend Django. Le port peut être activé ou désactivé selon ton lien."
            setTextColor(Color.DKGRAY)
            textSize = 14f
            setPadding(0, dp(14), 0, dp(12))
        }

        val hostInput = EditText(this).apply {
            hint = "Ex: 192.168.0.117 ou https://backend.com"
            setText(prefs.getBackendHost())
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine(true)
        }

        val portSwitch = Switch(this).apply {
            text = "Utiliser un port personnalisé"
            isChecked = prefs.isBackendPortEnabled()
            setPadding(0, dp(12), 0, dp(4))
        }

        val portInput = EditText(this).apply {
            hint = "Ex: 8000"
            setText(prefs.getBackendPort())
            inputType = InputType.TYPE_CLASS_NUMBER
            setSingleLine(true)
            isEnabled = portSwitch.isChecked
        }

        portSwitch.setOnCheckedChangeListener { _, checked ->
            portInput.isEnabled = checked
            portInput.alpha = if (checked) 1f else 0.45f
        }

        portInput.alpha = if (portSwitch.isChecked) 1f else 0.45f

        container.addView(serviceSwitch)
        container.addView(serviceHelpText)
        container.addView(batteryText)
        container.addView(batteryButton)
        container.addView(helpText)
        container.addView(labelText("Host / lien backend"))
        container.addView(hostInput)
        container.addView(portSwitch)
        container.addView(labelText("Port"))
        container.addView(portInput)

        AlertDialog.Builder(this)
            .setTitle("Paramètres")
            .setView(container)
            .setNegativeButton("Annuler", null)
            .setPositiveButton("Appliquer") { _, _ ->
                prefs.saveBackendConfig(
                    host = hostInput.text.toString(),
                    port = portInput.text.toString(),
                    portEnabled = portSwitch.isChecked
                )

                prefs.setOutboundServerEnabled(serviceSwitch.isChecked)

                if (
                    !serviceSwitch.isChecked ||
                    !prefs.isApplicationEnabled() ||
                    hasRequiredPermissions()
                ) {
                    AppRuntimeController.applyState(this)
                } else {
                    permissionLauncher.launch(requiredPermissions())
                }

                setupUI(hasRequiredPermissions())

                val message = if (serviceSwitch.isChecked) {
                    "Serveur local Django → Android activé."
                } else {
                    "Serveur local Django → Android désactivé."
                }

                Toast.makeText(this, message, Toast.LENGTH_LONG).show()
            }
            .show()
    }

    private fun installRuntimeTogglePanel() {
        val content = findViewById<ViewGroup>(android.R.id.content)
        val root = content.getChildAt(0) as? LinearLayout ?: return
        val prefs = Prefs(this)

        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(16), dp(20), dp(16))
            setBackgroundResource(R.drawable.bg_card)
        }

        masterToggle = Switch(this).apply {
            text = "Application active (arrière-plan complet)"
            setTextColor(Color.WHITE)
            textSize = 15f
            isChecked = prefs.isApplicationEnabled()
        }

        val masterHelp = TextView(this).apply {
            text = "OFF = arrêt du serveur HTTP, des services, des workers, de SMS_RECEIVED et du redémarrage au boot."
            setTextColor(Color.LTGRAY)
            textSize = 12f
            setPadding(0, 0, 0, dp(12))
        }

        autoReplyToggle = Switch(this).apply {
            text = "Réponses SMS automatiques via webhook"
            setTextColor(Color.WHITE)
            textSize = 15f
            isChecked = prefs.isAutoReplyWebhookEnabled()
        }

        val autoHelp = TextView(this).apply {
            text = "OFF = les SMS entrants ne sont plus envoyés à Django et aucune réponse automatique n'est envoyée. Le serveur local Django → Android peut rester actif."
            setTextColor(Color.LTGRAY)
            textSize = 12f
        }

        panel.addView(masterToggle)
        panel.addView(masterHelp)
        panel.addView(autoReplyToggle)
        panel.addView(autoHelp)

        val params = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            setMargins(dp(16), 0, dp(16), dp(8))
        }
        panel.layoutParams = params

        val insertIndex = (root.childCount - 1).coerceAtLeast(0)
        root.addView(panel, insertIndex)

        masterToggle.setOnCheckedChangeListener { _, enabled ->
            if (updatingRuntimeToggles) return@setOnCheckedChangeListener

            prefs.setApplicationEnabled(enabled)

            if (enabled && !hasRequiredPermissions()) {
                permissionLauncher.launch(requiredPermissions())
            } else {
                AppRuntimeController.applyState(this)
            }

            refreshRuntimeToggles()
            refreshStatusText(hasRequiredPermissions())
            refreshUrlsText()

            Toast.makeText(
                this,
                if (enabled) {
                    "Application réactivée avec les réglages précédents."
                } else {
                    "Application arrêtée: aucun fonctionnement arrière-plan."
                },
                Toast.LENGTH_LONG
            ).show()
        }

        autoReplyToggle.setOnCheckedChangeListener { _, enabled ->
            if (updatingRuntimeToggles) return@setOnCheckedChangeListener

            prefs.setAutoReplyWebhookEnabled(enabled)
            if (!enabled || !prefs.isApplicationEnabled() || hasRequiredPermissions()) {
                AppRuntimeController.applyState(this)
            } else {
                permissionLauncher.launch(requiredPermissions())
            }

            refreshRuntimeToggles()
            refreshStatusText(hasRequiredPermissions())
            refreshUrlsText()

            Toast.makeText(
                this,
                if (enabled) {
                    "Réponses SMS automatiques activées."
                } else {
                    "Réponses SMS automatiques désactivées."
                },
                Toast.LENGTH_SHORT
            ).show()
        }

        refreshRuntimeToggles()
    }

    private fun refreshRuntimeToggles() {
        if (!::masterToggle.isInitialized || !::autoReplyToggle.isInitialized) return

        val prefs = Prefs(this)
        updatingRuntimeToggles = true
        try {
            masterToggle.isChecked = prefs.isApplicationEnabled()
            autoReplyToggle.isChecked = prefs.isAutoReplyWebhookEnabled()
            autoReplyToggle.isEnabled = prefs.isApplicationEnabled()
            autoReplyToggle.alpha = if (prefs.isApplicationEnabled()) 1f else 0.45f
        } finally {
            updatingRuntimeToggles = false
        }
    }

    private fun labelText(value: String): TextView {
        return TextView(this).apply {
            text = value
            setTextColor(Color.BLACK)
            textSize = 13f
            gravity = Gravity.START
            setPadding(0, dp(10), 0, 0)
        }
    }

    private fun refreshUrlsText() {
        val prefs = Prefs(this)

        val localSmsUrl = NetworkUtils.buildLocalSmsSendUrl()
            ?: "IP du téléphone introuvable. Vérifiez le Wi-Fi."

        val localHealthUrl = NetworkUtils.getBestLocalIpv4Address()?.let {
            "http://$it:${Env.LOCAL_SMS_SERVER_PORT}${Env.LOCAL_SMS_HEALTH_PATH}"
        } ?: "indisponible"

        val allIps = NetworkUtils.getLocalIpv4Addresses()
            .joinToString(", ")
            .ifBlank { "Aucune IP détectée" }

        val serverStatus = when {
            !prefs.isApplicationEnabled() -> "arrêté par le toggle maître"
            prefs.isOutboundServerEnabled() -> "activé"
            else -> "désactivé"
        }

        val autoReplyStatus = when {
            !prefs.isApplicationEnabled() -> "ARRÊTÉE"
            prefs.isAutoReplyWebhookEnabled() -> "ACTIVE EN ARRIÈRE-PLAN"
            else -> "DÉSACTIVÉE"
        }

        val portStatus = if (prefs.isBackendPortEnabled()) {
            "activé : ${prefs.getBackendPort()}"
        } else {
            "désactivé"
        }

        val batteryStatus = if (isIgnoringBatteryOptimizations()) {
            "non optimisée / autorisée en arrière-plan"
        } else {
            "optimisation active"
        }

        val lastCapture = formatEventAge(prefs.getLastInboundCapturedAt())
        val lastBackend = formatEventAge(prefs.getLastInboundBackendAt())
        val lastReply = formatEventAge(prefs.getLastInboundReplyAt())

        urlText.text =
            "Réponse automatique SMS → Django → SMS : $autoReplyStatus\n" +
            "${prefs.getWebhookUrl()}\n" +
            "Dernier SMS capturé : $lastCapture\n" +
            "Dernier backend atteint : $lastBackend\n" +
            "Dernière réponse SMS : $lastReply\n" +
            "Port backend : $portStatus\n\n" +
            "Serveur Django → Android : $serverStatus\n" +
            "$localSmsUrl\n" +
            "Santé serveur : $localHealthUrl\n\n" +
            "Batterie : $batteryStatus\n" +
            "IP détectée(s) : $allIps"
    }

    private fun isIgnoringBatteryOptimizations(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true
        }

        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        return powerManager.isIgnoringBatteryOptimizations(packageName)
    }

    private fun openBatteryOptimizationSettings() {
        try {
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        } catch (e: Exception) {
            Toast.makeText(
                this,
                "Réglages batterie indisponibles: ${e.message}",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun hasRequiredPermissions(): Boolean {
        return requiredPermissions().all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun requiredPermissions(): Array<String> {
        val permissions = mutableListOf(
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.RECEIVE_MMS,
            Manifest.permission.READ_SMS,
            Manifest.permission.SEND_SMS,
            Manifest.permission.READ_PHONE_STATE
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        return permissions.toTypedArray()
    }

    private fun formatEventAge(timestampMs: Long): String {
        if (timestampMs <= 0L) return "jamais"

        val elapsedSeconds = ((System.currentTimeMillis() - timestampMs).coerceAtLeast(0L)) / 1000L
        return when {
            elapsedSeconds < 5 -> "à l'instant"
            elapsedSeconds < 60 -> "il y a ${elapsedSeconds}s"
            elapsedSeconds < 3600 -> "il y a ${elapsedSeconds / 60} min"
            else -> "il y a ${elapsedSeconds / 3600} h"
        }
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }

    override fun onStop() {
        // Le timer d'interface n'a aucune raison de tourner quand l'écran UI n'est plus visible.
        handler.removeCallbacks(updateRunnable)
        super.onStop()
    }

    override fun onStart() {
        super.onStart()
        if (::statusText.isInitialized) {
            handler.removeCallbacks(updateRunnable)
            handler.post(updateRunnable)
        }
    }

    override fun onDestroy() {
        handler.removeCallbacks(updateRunnable)
        super.onDestroy()
    }
}

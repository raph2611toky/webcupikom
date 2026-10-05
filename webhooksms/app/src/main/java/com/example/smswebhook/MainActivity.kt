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
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.example.smswebhook.ai.AssistantSettings
import com.example.smswebhook.ai.ConversationStore
import com.example.smswebhook.util.AppRuntimeController
import com.example.smswebhook.util.Env
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
    private val updateRunnable = object : Runnable {
        override fun run() {
            refreshRuntimeToggles()
            refreshStatusText(hasRequiredPermissions())
            refreshInfoText()
            handler.postDelayed(this, 3000)
        }
    }

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            setupUI(result.values.all { it })
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.status_text)
        urlText = findViewById(R.id.url_text)
        timerText = findViewById(R.id.timer_text)
        settingsButton = findViewById(R.id.settings_button)
        installRuntimeTogglePanel()

        settingsButton.setOnClickListener { showAssistantSettingsDialog() }

        if (hasRequiredPermissions()) setupUI(true)
        else permissionLauncher.launch(requiredPermissions())
    }

    override fun onResume() {
        super.onResume()
        if (::statusText.isInitialized && hasRequiredPermissions()) {
            AppRuntimeController.applyState(this)
            refreshRuntimeToggles()
            refreshStatusText(true)
            refreshInfoText()
        }
    }

    private fun setupUI(allGranted: Boolean) {
        refreshStatusText(allGranted)
        handler.removeCallbacks(updateRunnable)
        handler.post(updateRunnable)
        if (allGranted) AppRuntimeController.applyState(this)
        refreshRuntimeToggles()
        refreshInfoText()
    }

    private fun refreshStatusText(allGranted: Boolean) {
        val prefs = Prefs(this)
        val ai = AssistantSettings(this)
        statusText.text = when {
            !prefs.isApplicationEnabled() -> "TERRA NOVA SMS : ARRÊTÉ"
            !allGranted -> "Terra Nova SMS actif • permissions SMS manquantes"
            !ai.isConfigured() -> "Terra Nova SMS • clé Gemini manquante"
            prefs.isAutoReplyAssistantEnabled() -> "SMS → GEMINI → SMS : ACTIF"
            else -> "Réponses IA par SMS : DÉSACTIVÉES"
        }
    }

    private fun showAssistantSettingsDialog() {
        val ai = AssistantSettings(this)
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(12), dp(20), dp(4))
        }

        val help = TextView(this).apply {
            text = "Mode autonome : le téléphone reçoit le SMS, analyse la demande avec Terra Nova puis répond directement par SMS."
            setTextColor(Color.DKGRAY)
            textSize = 14f
            setPadding(0, 0, 0, dp(12))
        }

        val keyInput = EditText(this).apply {
            hint = "Clé Gemini API"
            setText(ai.getApiKey())
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setSingleLine(true)
        }

        val modelInput = EditText(this).apply {
            hint = Env.DEFAULT_GEMINI_MODEL
            setText(ai.getModel())
            inputType = InputType.TYPE_CLASS_TEXT
            setSingleLine(true)
        }

        val batteryText = TextView(this).apply {
            text = if (isIgnoringBatteryOptimizations()) {
                "Batterie : application autorisée en arrière-plan."
            } else {
                "Batterie : optimisation active. Pour un fonctionnement fiable, autorisez l'application sans restriction."
            }
            setTextColor(if (isIgnoringBatteryOptimizations()) Color.rgb(0, 110, 40) else Color.rgb(180, 90, 0))
            textSize = 13f
            setPadding(0, dp(12), 0, dp(8))
        }

        val batteryButton = Button(this).apply {
            text = "Réglages batterie"
            isAllCaps = false
            setOnClickListener { openBatteryOptimizationSettings() }
        }

        val clearButton = Button(this).apply {
            text = "Effacer conversations et dossiers locaux"
            isAllCaps = false
            setOnClickListener {
                ConversationStore(this@MainActivity).clearAllConversations()
                Toast.makeText(this@MainActivity, "Conversations locales effacées.", Toast.LENGTH_SHORT).show()
            }
        }

        container.addView(help)
        container.addView(labelText("Clé Gemini"))
        container.addView(keyInput)
        container.addView(labelText("Modèle"))
        container.addView(modelInput)
        container.addView(batteryText)
        container.addView(batteryButton)
        container.addView(clearButton)

        val scrollContainer = ScrollView(this).apply {
            isFillViewport = true
            addView(container)
        }

        AlertDialog.Builder(this)
            .setTitle("Assistant Terra Nova")
            .setView(scrollContainer)
            .setNegativeButton("Annuler", null)
            .setPositiveButton("Enregistrer") { _, _ ->
                ai.save(keyInput.text.toString(), modelInput.text.toString())
                refreshStatusText(hasRequiredPermissions())
                refreshInfoText()
                Toast.makeText(this, "Configuration Gemini enregistrée.", Toast.LENGTH_SHORT).show()
            }
            .show()
    }

    private fun installRuntimeTogglePanel() {
        val root = findViewById<LinearLayout>(R.id.main_content)
        val prefs = Prefs(this)

        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(16), dp(20), dp(16))
            setBackgroundResource(R.drawable.bg_card)
        }

        masterToggle = Switch(this).apply {
            text = "Application active en arrière-plan"
            setTextColor(Color.WHITE)
            textSize = 15f
            isChecked = prefs.isApplicationEnabled()
        }

        val masterHelp = TextView(this).apply {
            text = "OFF = aucun SMS entrant n'est traité par l'assistant."
            setTextColor(Color.LTGRAY)
            textSize = 12f
            setPadding(0, 0, 0, dp(12))
        }

        autoReplyToggle = Switch(this).apply {
            text = "Réponses automatiques Terra Nova via Gemini"
            setTextColor(Color.WHITE)
            textSize = 15f
            isChecked = prefs.isAutoReplyAssistantEnabled()
        }

        val autoHelp = TextView(this).apply {
            text = "Flux direct : SMS entrant → assistant Terra Nova → réponse SMS. Les dossiers validés sont conservés sur cet appareil."
            setTextColor(Color.LTGRAY)
            textSize = 12f
        }

        panel.addView(masterToggle)
        panel.addView(masterHelp)
        panel.addView(autoReplyToggle)
        panel.addView(autoHelp)

        panel.layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { setMargins(dp(16), 0, dp(16), dp(8)) }

        root.addView(panel, (root.childCount - 1).coerceAtLeast(0))

        masterToggle.setOnCheckedChangeListener { _, enabled ->
            if (updatingRuntimeToggles) return@setOnCheckedChangeListener
            prefs.setApplicationEnabled(enabled)
            if (enabled && !hasRequiredPermissions()) permissionLauncher.launch(requiredPermissions())
            else AppRuntimeController.applyState(this)
            refreshRuntimeToggles(); refreshStatusText(hasRequiredPermissions()); refreshInfoText()
        }

        autoReplyToggle.setOnCheckedChangeListener { _, enabled ->
            if (updatingRuntimeToggles) return@setOnCheckedChangeListener
            prefs.setAutoReplyAssistantEnabled(enabled)
            if (!enabled || !prefs.isApplicationEnabled() || hasRequiredPermissions()) AppRuntimeController.applyState(this)
            else permissionLauncher.launch(requiredPermissions())
            refreshRuntimeToggles(); refreshStatusText(hasRequiredPermissions()); refreshInfoText()
        }
    }

    private fun refreshRuntimeToggles() {
        if (!::masterToggle.isInitialized || !::autoReplyToggle.isInitialized) return
        val prefs = Prefs(this)
        updatingRuntimeToggles = true
        try {
            masterToggle.isChecked = prefs.isApplicationEnabled()
            autoReplyToggle.isChecked = prefs.isAutoReplyAssistantEnabled()
            autoReplyToggle.isEnabled = prefs.isApplicationEnabled()
            autoReplyToggle.alpha = if (prefs.isApplicationEnabled()) 1f else 0.45f
        } finally { updatingRuntimeToggles = false }
    }

    private fun refreshInfoText() {
        val prefs = Prefs(this)
        val ai = AssistantSettings(this)
        val active = prefs.isApplicationEnabled() && prefs.isAutoReplyAssistantEnabled()
        urlText.text =
            "Architecture : téléphone Android autonome\n" +
            "Flux : SMS entrant → Gemini ${ai.getModel()} → SMS sortant\n" +
            "Clé : ${ai.maskedKey()}\n" +
            "Mode : assistant municipal local\n" +
            "Fonctions : signalements, rendez-vous, démarches, contacts, confidentialité, projets et suivi local"

        val lastCapture = formatEventAge(prefs.getLastInboundCapturedAt())
        val lastGemini = formatEventAge(prefs.getLastGeminiResponseAt())
        val lastReply = formatEventAge(prefs.getLastInboundReplyAt())
        timerText.text = if (active) {
            "Dernier SMS : $lastCapture • Gemini : $lastGemini • Réponse : $lastReply"
        } else {
            "Assistant SMS en pause"
        }
    }

    private fun labelText(value: String): TextView = TextView(this).apply {
        text = value
        setTextColor(Color.BLACK)
        textSize = 13f
        gravity = Gravity.START
        setPadding(0, dp(10), 0, 0)
    }

    private fun isIgnoringBatteryOptimizations(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        return pm.isIgnoringBatteryOptimizations(packageName)
    }

    private fun openBatteryOptimizationSettings() {
        try { startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) }
        catch (e: Exception) { Toast.makeText(this, "Réglages batterie indisponibles.", Toast.LENGTH_LONG).show() }
    }

    private fun hasRequiredPermissions(): Boolean = requiredPermissions().all {
        ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
    }

    private fun requiredPermissions(): Array<String> {
        val permissions = mutableListOf(
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.READ_SMS,
            Manifest.permission.SEND_SMS,
            Manifest.permission.READ_PHONE_STATE
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        return permissions.toTypedArray()
    }

    private fun formatEventAge(timestampMs: Long): String {
        if (timestampMs <= 0L) return "jamais"
        val s = ((System.currentTimeMillis() - timestampMs).coerceAtLeast(0L)) / 1000L
        return when {
            s < 5 -> "maintenant"
            s < 60 -> "${s}s"
            s < 3600 -> "${s / 60} min"
            else -> "${s / 3600} h"
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    override fun onStart() {
        super.onStart()
        if (::statusText.isInitialized) { handler.removeCallbacks(updateRunnable); handler.post(updateRunnable) }
    }

    override fun onStop() { handler.removeCallbacks(updateRunnable); super.onStop() }
    override fun onDestroy() { handler.removeCallbacks(updateRunnable); super.onDestroy() }
}

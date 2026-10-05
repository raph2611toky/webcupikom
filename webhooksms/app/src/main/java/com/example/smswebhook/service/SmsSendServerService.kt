package com.example.smswebhook.service

import android.app.Application
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.ComponentCallbacks2
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.Process
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.example.smswebhook.util.Env
import com.example.smswebhook.util.NetworkUtils
import com.example.smswebhook.util.Prefs
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/**
 * Foreground service dédié au flux Django/Gateway -> Android -> SMS.
 *
 * Ce service tourne volontairement dans un processus Android séparé
 * (:sms_gateway, déclaré dans AndroidManifest.xml). Ainsi le processus UI peut
 * passer en arrière-plan sans partager son scheduling avec le listener NanoHTTPD.
 *
 * Les fonctionnalités SMS entrant -> Django, WorkManager et réponses automatiques
 * restent dans le processus principal et ne sont pas modifiées ici.
 */
class SmsSendServerService : Service() {

    @Volatile
    private var server: SmsSendHttpServer? = null

    @Volatile
    private var serviceEnabled: Boolean = false

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var watchdogExecutor: ScheduledExecutorService? = null

    @Volatile
    private var lastHealthyProbeAt: Long = 0L

    @Volatile
    private var lastWatchdogLogAt: Long = 0L

    @Volatile
    private var lastForegroundRefreshAt: Long = 0L

    @Volatile
    private var restartCount: Int = 0

    override fun onCreate() {
        super.onCreate()

        createNotificationChannel()
        acquireWakeLock()
        acquireWifiLock()

        // Promotion immédiate requise après startForegroundService().
        promoteToForeground("Initialisation du serveur SMS…")

        Log.i(
            TAG,
            "Processus gateway créé process=${Application.getProcessName()} pid=${Process.myPid()}"
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Quand le processus principal démarre explicitement le service, l'extra
        // évite toute dépendance à un cache SharedPreferences inter-processus.
        // Lors d'une recréation START_STICKY (intent == null), le processus est
        // neuf et peut relire l'état persisté depuis le disque.
        val shouldRun = if (intent?.hasExtra(EXTRA_ENABLE_SERVER) == true) {
            intent.getBooleanExtra(EXTRA_ENABLE_SERVER, false)
        } else {
            Prefs(this).isOutboundServerActive()
        }

        serviceEnabled = shouldRun

        if (!shouldRun) {
            Log.i(TAG, "Serveur d'envoi local désactivé; arrêt du processus gateway")
            stopSelf(startId)
            return START_NOT_STICKY
        }

        ensureLocksHeld()
        promoteToForeground(getNotificationText())

        if (watchdogExecutor == null || watchdogExecutor?.isShutdown == true) {
            startWatchdog()
        }

        if (server?.isAlive != true) {
            startSmsServer(forceRestart = true, reason = "start-command-not-alive")
        } else {
            runWatchdogSoon("start-command")
        }

        return START_STICKY
    }

    /** Démarre/recrée uniquement NanoHTTPD. */
    @Synchronized
    private fun startSmsServer(forceRestart: Boolean, reason: String) {
        if (!serviceEnabled) return

        val current = server

        if (!forceRestart && current?.isAlive == true) {
            Log.d(TAG, "Serveur SMS déjà actif ($reason)")
            return
        }

        if (current != null) {
            server = null
            stopServerBounded(current, reason)
        }

        var lastError: Exception? = null

        for (attempt in 1..SERVER_START_ATTEMPTS) {
            if (!serviceEnabled) return

            try {
                val freshServer = SmsSendHttpServer(
                    appContext = applicationContext,
                    port = Env.LOCAL_SMS_SERVER_PORT,
                    webhookToken = Env.WEBHOOK_TOKEN,
                    isServiceEnabled = { serviceEnabled }
                )

                // false => listener NanoHTTPD non-daemon.
                freshServer.start(SOCKET_READ_TIMEOUT, false)
                server = freshServer
                lastHealthyProbeAt = 0L

                val url = NetworkUtils.buildLocalSmsSendUrl()
                    ?: "http://IP_DU_PHONE:${Env.LOCAL_SMS_SERVER_PORT}${Env.LOCAL_SMS_SEND_PATH}"

                Log.i(
                    TAG,
                    "Serveur SMS démarré : $url reason=$reason attempt=$attempt " +
                        "restarts=$restartCount process=${Application.getProcessName()} pid=${Process.myPid()}"
                )

                refreshForegroundMarker(force = true)
                runWatchdogSoon("post-start-$reason")
                return
            } catch (e: Exception) {
                lastError = e
                Log.w(
                    TAG,
                    "Échec démarrage serveur SMS attempt=$attempt/$SERVER_START_ATTEMPTS " +
                        "reason=$reason: ${e.message}"
                )

                if (attempt < SERVER_START_ATTEMPTS) {
                    try {
                        Thread.sleep(SERVER_REBIND_DELAY_MS)
                    } catch (_: InterruptedException) {
                        Thread.currentThread().interrupt()
                        break
                    }
                }
            }
        }

        server = null
        Log.e(
            TAG,
            "Impossible de redémarrer le serveur SMS reason=$reason: ${lastError?.message}",
            lastError
        )
    }

    /**
     * NanoHTTPD.stop() peut attendre son listener sans timeout. On ne laisse
     * jamais cette attente bloquer le watchdog du processus gateway.
     */
    private fun stopServerBounded(oldServer: SmsSendHttpServer, reason: String) {
        val cleanup = Thread(
            {
                try {
                    oldServer.stop()
                } catch (e: Exception) {
                    Log.w(TAG, "Erreur arrêt ancien NanoHTTPD reason=$reason: ${e.message}", e)
                }
            },
            "SmsHttpCleanup-$restartCount"
        ).apply {
            isDaemon = true
        }

        cleanup.start()

        try {
            cleanup.join(SERVER_STOP_GRACE_MS)
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
        }

        if (cleanup.isAlive) {
            Log.w(
                TAG,
                "Ancien NanoHTTPD toujours en nettoyage après ${SERVER_STOP_GRACE_MS}ms " +
                    "reason=$reason; le gateway continue sans bloquer"
            )
        }
    }

    @Synchronized
    private fun stopSmsServerOnly(reason: String) {
        val old = server ?: return
        server = null
        stopServerBounded(old, reason)
    }

    private fun startWatchdog() {
        stopWatchdog()

        watchdogExecutor = Executors.newSingleThreadScheduledExecutor { runnable ->
            Thread(runnable, "SmsHttpWatchdog").apply {
                isDaemon = false
                priority = Thread.NORM_PRIORITY
            }
        }.also { executor ->
            executor.scheduleWithFixedDelay(
                { watchdogTick("periodic") },
                WATCHDOG_INITIAL_DELAY_MS,
                WATCHDOG_INTERVAL_MS,
                TimeUnit.MILLISECONDS
            )
        }

        Log.i(
            TAG,
            "Watchdog HTTP actif dans ${Application.getProcessName()}: " +
                "probe=${WATCHDOG_INTERVAL_MS}ms timeout=${HEALTH_PROBE_TIMEOUT_MS}ms"
        )
    }

    private fun stopWatchdog() {
        try {
            watchdogExecutor?.shutdownNow()
        } catch (e: Exception) {
            Log.w(TAG, "Erreur arrêt watchdog: ${e.message}")
        } finally {
            watchdogExecutor = null
        }
    }

    private fun runWatchdogSoon(reason: String) {
        try {
            watchdogExecutor?.execute { watchdogTick(reason) }
        } catch (e: Exception) {
            Log.d(TAG, "Watchdog immédiat ignoré ($reason): ${e.message}")
        }
    }

    private fun watchdogTick(reason: String) {
        try {
            if (!serviceEnabled) {
                Log.i(TAG, "Watchdog: serveur local désactivé")
                stopSelf()
                return
            }

            ensureLocksHeld()
            refreshForegroundMarker(force = false)

            val current = server
            val nanoAlive = current?.isAlive == true
            val httpHealthy = nanoAlive && probeLocalHttpHealth()
            val now = System.currentTimeMillis()

            if (httpHealthy) {
                lastHealthyProbeAt = now

                if (now - lastWatchdogLogAt >= WATCHDOG_HEARTBEAT_LOG_MS) {
                    lastWatchdogLogAt = now
                    Log.i(
                        TAG,
                        "Watchdog OK reason=$reason process=${Application.getProcessName()} " +
                            "pid=${Process.myPid()} nanoAlive=$nanoAlive " +
                            "wake=${wakeLock?.isHeld == true} wifi=${wifiLock?.isHeld == true} " +
                            "restarts=$restartCount ${current?.diagnostics().orEmpty()}"
                    )
                }
            } else {
                val lastGoodAge = if (lastHealthyProbeAt > 0L) {
                    now - lastHealthyProbeAt
                } else {
                    -1L
                }

                Log.w(
                    TAG,
                    "Watchdog HTTP ECHEC reason=$reason nanoAlive=$nanoAlive " +
                        "lastGoodAgeMs=$lastGoodAge ${current?.diagnostics().orEmpty()}"
                )

                restartCount += 1
                startSmsServer(
                    forceRestart = true,
                    reason = "health-failed-$reason"
                )
            }
        } catch (e: Throwable) {
            // Une exception non capturée annulerait les prochaines exécutions du
            // ScheduledExecutorService.
            Log.e(TAG, "Watchdog serveur SMS: ${e.message}", e)
        }
    }

    /** Exige une vraie réponse HTTP 200, pas seulement un socket LISTEN. */
    private fun probeLocalHttpHealth(): Boolean {
        var connection: HttpURLConnection? = null

        return try {
            val url = URL(
                "http://127.0.0.1:${Env.LOCAL_SMS_SERVER_PORT}${Env.LOCAL_SMS_HEALTH_PATH}"
            )

            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = HEALTH_PROBE_TIMEOUT_MS
                readTimeout = HEALTH_PROBE_TIMEOUT_MS
                useCaches = false
                instanceFollowRedirects = false
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Connection", "close")
            }

            connection.responseCode == HttpURLConnection.HTTP_OK
        } catch (e: Exception) {
            Log.w(TAG, "Health loopback sans réponse: ${e.javaClass.simpleName}: ${e.message}")
            false
        } finally {
            try {
                connection?.disconnect()
            } catch (_: Exception) {
                // rien
            }
        }
    }

    private fun acquireWakeLock() {
        try {
            val powerManager = getSystemService(POWER_SERVICE) as PowerManager

            if (wakeLock?.isHeld == true) return

            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "$packageName:SmsSendServer"
            ).apply {
                setReferenceCounted(false)
                if (!isHeld) acquire()
            }

            Log.i(TAG, "WakeLock acquis pour le processus gateway")
        } catch (e: Exception) {
            Log.w(TAG, "Impossible d'acquérir le WakeLock: ${e.message}")
        }
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.let {
                if (it.isHeld) it.release()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Erreur release WakeLock: ${e.message}")
        } finally {
            wakeLock = null
        }
    }

    @Suppress("DEPRECATION")
    private fun acquireWifiLock() {
        try {
            val wifiManager = applicationContext.getSystemService(WIFI_SERVICE) as WifiManager

            if (wifiLock?.isHeld == true) return

            wifiLock = wifiManager.createWifiLock(
                WifiManager.WIFI_MODE_FULL_HIGH_PERF,
                "$packageName:SmsSendServerWifi"
            ).apply {
                setReferenceCounted(false)
                if (!isHeld) acquire()
            }

            Log.i(TAG, "WifiLock acquis pour le processus gateway")
        } catch (e: Exception) {
            Log.w(TAG, "Impossible d'acquérir le WifiLock: ${e.message}")
        }
    }

    private fun releaseWifiLock() {
        try {
            wifiLock?.let {
                if (it.isHeld) it.release()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Erreur release WifiLock: ${e.message}")
        } finally {
            wifiLock = null
        }
    }

    private fun ensureLocksHeld() {
        if (wakeLock?.isHeld != true) acquireWakeLock()
        if (wifiLock?.isHeld != true) acquireWifiLock()
    }

    /**
     * Renouvelle périodiquement l'enregistrement de la notification du FGS.
     * Le contenu ne change pas visuellement; cette interaction avec system_server
     * fournit aussi un heartbeat externe au processus, contrairement à une boucle
     * purement Java interne.
     */
    private fun refreshForegroundMarker(force: Boolean) {
        val now = System.currentTimeMillis()
        if (!force && now - lastForegroundRefreshAt < FOREGROUND_REFRESH_INTERVAL_MS) return

        lastForegroundRefreshAt = now

        try {
            val notification = buildNotification(getNotificationText())
            val manager = getSystemService(NotificationManager::class.java)
            manager?.notify(NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            Log.w(TAG, "Impossible de rafraîchir la notification FGS: ${e.message}")
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        Log.w(TAG, "Tâche UI retirée; processus gateway indépendant conservé")
        ensureLocksHeld()

        if (serviceEnabled) {
            runWatchdogSoon("task-removed")
        }

        super.onTaskRemoved(rootIntent)
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)

        if (level >= ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) {
            Log.i(TAG, "trimMemory=$level dans processus gateway -> contrôle HTTP")
            ensureLocksHeld()
            runWatchdogSoon("trim-memory-$level")
        }
    }

    override fun onLowMemory() {
        Log.w(
            TAG,
            "onLowMemory; nanoAlive=${server?.isAlive == true} ${server?.diagnostics().orEmpty()}"
        )
        runWatchdogSoon("low-memory")
        super.onLowMemory()
    }

    override fun onDestroy() {
        serviceEnabled = false
        stopWatchdog()
        stopSmsServerOnly("service-destroy")
        releaseWifiLock()
        releaseWakeLock()
        Log.i(TAG, "Service serveur SMS détruit process=${Application.getProcessName()}")
        super.onDestroy()
    }

    private fun getNotificationText(): String {
        if (!serviceEnabled) {
            return "Initialisation du serveur SMS…"
        }

        val url = NetworkUtils.buildLocalSmsSendUrl()

        return if (url != null) {
            "Écoute permanente : $url"
        } else {
            "Serveur actif sur port ${Env.LOCAL_SMS_SERVER_PORT}"
        }
    }

    private fun promoteToForeground(content: String) {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING
        } else {
            0
        }

        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(content),
            type
        )
    }

    private fun buildNotification(content: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("AgriConnect SMS Gateway")
            .setContentText(content)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "SMS Gateway permanent",
                NotificationManager.IMPORTANCE_LOW
            )

            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val EXTRA_ENABLE_SERVER = "com.example.smswebhook.extra.ENABLE_SMS_GATEWAY"

        private const val TAG = "SmsSendServerService"
        private const val CHANNEL_ID = "sms_send_server_channel"
        private const val NOTIFICATION_ID = 2001

        private const val SOCKET_READ_TIMEOUT = 5000

        private const val WATCHDOG_INITIAL_DELAY_MS = 1_500L
        private const val WATCHDOG_INTERVAL_MS = 4_000L
        private const val HEALTH_PROBE_TIMEOUT_MS = 1_200
        private const val WATCHDOG_HEARTBEAT_LOG_MS = 30_000L

        // Heartbeat vers system_server sans modifier visiblement la notification.
        private const val FOREGROUND_REFRESH_INTERVAL_MS = 10_000L

        private const val SERVER_STOP_GRACE_MS = 450L
        private const val SERVER_REBIND_DELAY_MS = 250L
        private const val SERVER_START_ATTEMPTS = 4
    }
}

package com.example.smswebhook.util

object Env {
    /*
     * Configuration par défaut du backend Django.
     * L'URL finale est construite dynamiquement par Prefs :
     * http(s)://HOST[:PORT]/api/chatbot/sms/webhook/
 * En production, HTTPS AgriConnect est utilisé par défaut sans port personnalisé.
     */
    const val DEFAULT_BACKEND_HOST = "https://backend.agriconnect.ik0m.tech"
    const val DEFAULT_BACKEND_PORT = 8000
    const val DEFAULT_BACKEND_PORT_ENABLED = false
    const val WEBHOOK_PATH = "/api/chatbot/sms/webhook/"

    /*
     * Token utilisé dans les deux sens :
     * - Android -> Django pour les SMS entrants
     * - Django -> Android pour demander l'envoi d'un SMS
     */
    const val WEBHOOK_TOKEN = "HZZFQWVathzihNNidlnNFmzmAWjgxqRdprWkMgujvwyPyxNBBMgGCTpyWLjYKucHtGUSyRcaVgLiaGPONOpoBxDHSNDAjPqBiaMNyjMnnXHlVZkFUwoJspuqsWMKBBHRgpqLfsTaWlnYXEDUnJDdAKDLHbiELlSfFoRKqNtTYlxBHzqogcoFIpuclnUTKgyXZNKZSTVDYcUtAjnwVAoedRhjdwYbYopQUifEAdSgfUOKIcDHhazBTimCqF"

    /*
     * Serveur local Android.
     * Le téléphone écoute sur toutes les interfaces : 0.0.0.0:8000
     * L'URL publique est construite dynamiquement avec NetworkUtils.
     */
    const val LOCAL_SMS_SERVER_PORT = 8000
    const val LOCAL_SMS_SEND_PATH = "/sms/webhook/send/"
    const val LOCAL_SMS_HEALTH_PATH = "/sms/webhook/health/"

    const val CONNECT_TIMEOUT_SECONDS = 20L
    const val READ_TIMEOUT_SECONDS = 30L
    const val WRITE_TIMEOUT_SECONDS = 30L
}

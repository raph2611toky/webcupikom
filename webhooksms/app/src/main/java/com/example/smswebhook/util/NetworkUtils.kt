package com.example.smswebhook.util

import java.net.Inet4Address
import java.net.NetworkInterface

object NetworkUtils {

    fun getLocalIpv4Addresses(): List<String> {
        val addresses = mutableListOf<String>()

        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()

            while (interfaces.hasMoreElements()) {
                val networkInterface = interfaces.nextElement()

                if (!networkInterface.isUp || networkInterface.isLoopback) {
                    continue
                }

                val inetAddresses = networkInterface.inetAddresses

                while (inetAddresses.hasMoreElements()) {
                    val inetAddress = inetAddresses.nextElement()

                    if (
                        inetAddress is Inet4Address &&
                        !inetAddress.isLoopbackAddress
                    ) {
                        val ip = inetAddress.hostAddress

                        if (!ip.isNullOrBlank()) {
                            addresses.add(ip)
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return addresses.distinct()
    }

    fun getBestLocalIpv4Address(): String? {
        val addresses = getLocalIpv4Addresses()

        if (addresses.isEmpty()) {
            return null
        }

        // Priorité aux IP Wi-Fi locales classiques
        return addresses.firstOrNull { it.startsWith("192.168.") }
            ?: addresses.firstOrNull { it.startsWith("10.") }
            ?: addresses.firstOrNull { isPrivate172Address(it) }
            ?: addresses.first()
    }

    private fun isPrivate172Address(ip: String): Boolean {
        val parts = ip.split(".")

        if (parts.size < 2) {
            return false
        }

        val first = parts[0].toIntOrNull()
        val second = parts[1].toIntOrNull()

        return first == 172 && second != null && second in 16..31
    }

    fun buildLocalSmsSendUrl(): String? {
        val ip = getBestLocalIpv4Address() ?: return null

        return "http://$ip:${Env.LOCAL_SMS_SERVER_PORT}${Env.LOCAL_SMS_SEND_PATH}"
    }
}
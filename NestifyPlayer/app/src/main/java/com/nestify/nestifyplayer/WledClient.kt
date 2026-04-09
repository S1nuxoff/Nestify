package com.nestify.nestifyplayer

import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.abs

class WledClient {

    private var lastR = -1
    private var lastG = -1
    private var lastB = -1

    // робимо більш чутливим, щоб Ambilight не "залипав"
    private val minDeltaPerChannel = 3

    /**
     * Формат wledIp:
     *
     * 192.168.0.221
     * 192.168.0.222  # кухня
     * 192.168.0.223  # спальня
     *
     * Можна кілька IP через пробіл/кому на рядку, рядки з # — коменти.
     */
    private fun parseTargets(): List<String> {
        if (AmbientConfig.wledIp.isBlank()) return emptyList()

        val lines = AmbientConfig.wledIp
            .split('\n', '\r')
            .map { it.trim() }
            .filter { it.isNotEmpty() && !it.startsWith("#") }

        val ips = mutableListOf<String>()
        for (line in lines) {
            val noComment = line.substringBefore("#").trim()
            if (noComment.isEmpty()) continue

            noComment
                .split(',', ' ', ';', '\t')
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .forEach { ips.add(it) }
        }

        return ips.distinct()
    }

    fun sendColor(r: Int, g: Int, b: Int) {
        if (!AmbientConfig.enabled) return

        val targets = parseTargets()
        if (targets.isEmpty()) return

        if (lastR >= 0) {
            if (abs(lastR - r) < minDeltaPerChannel &&
                abs(lastG - g) < minDeltaPerChannel &&
                abs(lastB - b) < minDeltaPerChannel
            ) {
                // зміна занадто маленька — скіпаємо
                return
            }
        }

        // Найпростіший і стабільний JSON — як у тебе працювало раніше
        val json = """{"on":true,"seg":[{"col":[[$r,$g,$b]]}]}"""

        targets.forEach { ip ->
            try {
                val url = URL("http://$ip/json/state")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true

                conn.outputStream.use { os ->
                    os.write(json.toByteArray())
                    os.flush()
                }
                conn.inputStream.use { _ -> }
                conn.disconnect()
            } catch (_: Exception) {
            }
        }

        lastR = r
        lastG = g
        lastB = b
    }

    fun turnOff() {
        val targets = parseTargets()
        if (targets.isEmpty()) return

        val json = """{"on":false}"""

        try {
            targets.forEach { ip ->
                val url = URL("http://$ip/json/state")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true

                conn.outputStream.use { os ->
                    os.write(json.toByteArray())
                    os.flush()
                }
                conn.inputStream.use { _ -> }
                conn.disconnect()
            }
        } catch (_: Exception) {
        } finally {
            lastR = -1
            lastG = -1
            lastB = -1
        }
    }
}

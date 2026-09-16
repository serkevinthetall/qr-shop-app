package com.qrshop.myanmar.network

import android.util.Log
import okhttp3.Dns
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.InetAddress
import java.net.UnknownHostException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * Cloudflare DNS-over-HTTPS for API hosts.
 *
 * Critical: never fall back to Dns.SYSTEM for allowlisted hosts — Atom's
 * default DNS fails and would undo DoH. If DoH fails, use baked-in Cloudflare
 * edge IPs (same ones Private DNS returns when it works).
 */
object DohDns : Dns {
  private const val TAG = "DohDns"
  private const val CACHE_TTL_MS = 300_000L

  private val allowlist =
    setOf(
      "www.qrshop.online",
      "qrshop.online",
    )

  /**
   * Last-known Cloudflare proxy IPs for www.qrshop.online.
   * Used only when DoH cannot run — better than Atom system DNS.
   */
  private val bakedInFallbackIps =
    listOf(
      "104.21.49.33",
      "172.67.158.120",
    )

  private data class CacheEntry(
    val addresses: List<InetAddress>,
    val expiresAtMs: Long,
  )

  private val cache = ConcurrentHashMap<String, CacheEntry>()

  private val bootstrapClient =
    OkHttpClient.Builder()
      .connectTimeout(15, TimeUnit.SECONDS)
      .readTimeout(15, TimeUnit.SECONDS)
      .callTimeout(20, TimeUnit.SECONDS)
      .retryOnConnectionFailure(true)
      .build()

  private val dohEndpoints =
    listOf(
      "https://1.1.1.1/dns-query",
      "https://1.0.0.1/dns-query",
      "https://8.8.8.8/dns-query",
    )

  override fun lookup(hostname: String): List<InetAddress> {
    val host = hostname.trim().lowercase().trimEnd('.')

    if (host !in allowlist) {
      return Dns.SYSTEM.lookup(hostname)
    }

    val cached = cache[host]
    if (cached != null && cached.expiresAtMs > System.currentTimeMillis()) {
      Log.i(TAG, "cache hit $host")
      return cached.addresses
    }

    try {
      val resolved = resolveViaDoh(host)
      if (resolved.isNotEmpty()) {
        cache[host] =
          CacheEntry(
            addresses = resolved,
            expiresAtMs = System.currentTimeMillis() + CACHE_TTL_MS,
          )
        Log.i(TAG, "Cloudflare DoH ok $host -> ${resolved.joinToString { it.hostAddress ?: "?" }}")
        return resolved
      }
    } catch (error: Exception) {
      Log.w(TAG, "Cloudflare DoH failed for $host — using baked-in IPs (not Atom DNS)", error)
    }

    val fallback = bakedInFallbackAddresses()
    cache[host] =
      CacheEntry(
        addresses = fallback,
        expiresAtMs = System.currentTimeMillis() + 60_000L,
      )
    Log.i(TAG, "baked-in fallback $host -> ${fallback.joinToString { it.hostAddress ?: "?" }}")
    return fallback
  }

  private fun bakedInFallbackAddresses(): List<InetAddress> {
    return bakedInFallbackIps.mapNotNull { ipv4LiteralToInetAddress(it) }.ifEmpty {
      throw UnknownHostException("No baked-in Cloudflare IPs for API host")
    }
  }

  private fun resolveViaDoh(hostname: String): List<InetAddress> {
    var lastError: Exception? = null

    for (endpoint in dohEndpoints) {
      try {
        val url =
          endpoint
            .toHttpUrl()
            .newBuilder()
            .addQueryParameter("name", hostname)
            .addQueryParameter("type", "A")
            .build()

        val request =
          Request.Builder()
            .url(url)
            .header("accept", "application/dns-json")
            .get()
            .build()

        bootstrapClient.newCall(request).execute().use { response ->
          if (!response.isSuccessful) {
            throw UnknownHostException("DoH HTTP ${response.code} via $endpoint")
          }
          val body =
            response.body?.string()
              ?: throw UnknownHostException("Empty DoH body via $endpoint")
          val addresses = parseDnsJson(body)
          if (addresses.isNotEmpty()) {
            return addresses
          }
        }
      } catch (error: Exception) {
        lastError = error
      }
    }

    if (lastError != null) {
      throw lastError
    }
    return emptyList()
  }

  private fun parseDnsJson(json: String): List<InetAddress> {
    val root = JSONObject(json)
    if (root.optInt("Status", -1) != 0) {
      return emptyList()
    }

    val answer = root.optJSONArray("Answer") ?: return emptyList()
    val out = ArrayList<InetAddress>()

    for (i in 0 until answer.length()) {
      val item = answer.optJSONObject(i) ?: continue
      if (item.optInt("type") != 1) {
        continue
      }
      val data = item.optString("data").trim()
      val address = ipv4LiteralToInetAddress(data) ?: continue
      out.add(address)
    }

    return out
  }

  private fun ipv4LiteralToInetAddress(value: String): InetAddress? {
    val parts = value.split('.')
    if (parts.size != 4) {
      return null
    }

    return try {
      val bytes = ByteArray(4)
      for (i in 0 until 4) {
        val octet = parts[i].toInt()
        if (octet < 0 || octet > 255) {
          return null
        }
        bytes[i] = octet.toByte()
      }
      InetAddress.getByAddress(bytes)
    } catch (_: Exception) {
      null
    }
  }
}

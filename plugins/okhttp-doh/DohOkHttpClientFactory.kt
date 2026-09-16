package com.qrshop.myanmar.network

import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider
import okhttp3.CertificatePinner
import okhttp3.ConnectionSpec
import okhttp3.OkHttpClient
import okhttp3.Protocol

/**
 * RN / Expo fetch OkHttp client with:
 * - Cloudflare DoH DNS + HTTP/1.1 (Atom mid-handshake mitigation)
 * - Public-key (SPKI) pinning for API hosts (MITM resistance)
 *
 * Pins include leaf + intermediate so routine leaf rotations are less brittle.
 * Rotate pins here AND in services/ssl-pinning.ts (iOS) when hosts change CA.
 */
class DohOkHttpClientFactory : OkHttpClientFactory {
  override fun createNewNetworkModuleClient(): OkHttpClient {
    val pinner = CertificatePinner.Builder()
      // www.qrshop.online (Cloudflare / Let's Encrypt YR2)
      .add(
        "www.qrshop.online",
        "sha256/3+zn2KT/mOeNBAcChjtnx3e0d4rIsPBtO9Gcigc4Qf8=",
        "sha256/nWN7PSep5XDQdge5zK24CnCRXHr3KvzhKEGxsdqCX9E=",
      )
      .add(
        "qrshop.online",
        "sha256/3+zn2KT/mOeNBAcChjtnx3e0d4rIsPBtO9Gcigc4Qf8=",
        "sha256/nWN7PSep5XDQdge5zK24CnCRXHr3KvzhKEGxsdqCX9E=",
      )
      // Vercel API host
      .add(
        "qr-shop-app-backend.vercel.app",
        "sha256/xRUwi70J41GFIbtkDY38VXIAoWtbsGGG+LWfenCZh7k=",
        "sha256/yDu9og255NN5GEf+Bwa9rTrqFQ0EydZ0r1FCh9TdAW4=",
      )
      // Netlify failover host
      .add(
        "qrshopmyanmar.netlify.app",
        "sha256/DFv0rPImhleLzIvctvEusBa5wnzQ/+aSqyW18y26L+s=",
        "sha256/Wec45nQiFwKvHtuHxSAMGkt19k+uPSw9JlEkxhvYPHk=",
      )
      .build()

    return OkHttpClientProvider.createClientBuilder()
      .dns(DohDns)
      .certificatePinner(pinner)
      .protocols(listOf(Protocol.HTTP_1_1))
      .connectionSpecs(
        listOf(
          ConnectionSpec.MODERN_TLS,
          ConnectionSpec.COMPATIBLE_TLS,
        ),
      )
      .retryOnConnectionFailure(true)
      .build()
  }
}

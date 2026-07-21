package de.quavon.jackpoll.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import org.unifiedpush.android.connector.FailedReason
import org.unifiedpush.android.connector.MessagingReceiver
import org.unifiedpush.android.connector.data.PushEndpoint
import org.unifiedpush.android.connector.data.PushMessage

/**
 * Receives UnifiedPush lifecycle events from the active distributor. The
 * connector delivers Web Push (RFC 8291) messages already decrypted, so
 * [onMessage] gets our plaintext JSON payload ({"title","body"}).
 *
 * Declared in AndroidManifest with the UnifiedPush intent filters.
 */
class UnifiedPushReceiver : MessagingReceiver() {

    companion object {
        private const val TAG = "UnifiedPushReceiver"
        private const val CHANNEL_ID = "jackpoll_default"
    }

    override fun onNewEndpoint(context: Context, endpoint: PushEndpoint, instance: String) {
        val url = endpoint.url
        val pubKey = endpoint.pubKeySet?.pubKey
        val auth = endpoint.pubKeySet?.auth
        Log.i(TAG, "New endpoint for '$instance'")
        PushManager.storeEndpoint(context, url, pubKey, auth)
        // Hand off to the web layer so it registers with the backend like a
        // browser PushSubscription ({endpoint, keys:{p256dh, auth}}).
        PushBridge.emitEndpoint(url, pubKey, auth)
    }

    override fun onMessage(context: Context, message: PushMessage, instance: String) {
        // The connector only hands us plaintext when it could decrypt the Web
        // Push body (RFC 8291, aes128gcm). If decryption failed, content is raw
        // ciphertext — rendering it produces garbled notifications, so drop it.
        if (!message.decrypted) {
            Log.w(TAG, "dropping undecryptable push message")
            return
        }
        val text = try { String(message.content, Charsets.UTF_8) } catch (t: Throwable) { "" }
        val (title, body) = parse(text)
        notify(context, title, body)
    }

    override fun onUnregistered(context: Context, instance: String) {
        Log.i(TAG, "Unregistered '$instance'")
        PushManager.clearEndpoint(context)
        PushBridge.emitUnregistered()
    }

    override fun onRegistrationFailed(context: Context, reason: FailedReason, instance: String) {
        Log.w(TAG, "Registration failed: $reason")
        PushBridge.emitError(reason.name)
    }

    private fun parse(payload: String): Pair<String, String> = try {
        val o = JSONObject(payload)
        (o.optString("title", "Jackpoll")) to (o.optString("body", ""))
    } catch (t: Throwable) {
        "Jackpoll" to payload
    }

    private fun notify(context: Context, title: String, body: String) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Jackpoll", NotificationManager.IMPORTANCE_DEFAULT)
            )
        }
        val n = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(context.applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .build()
        nm.notify(System.currentTimeMillis().toInt(), n)
    }
}

package de.quavon.jackpoll.push

import org.json.JSONObject

/**
 * Decouples the (system-instantiated) [UnifiedPushReceiver] from the Capacitor
 * [PushBridgePlugin]. Events are queued until the web layer's plugin attaches,
 * so an endpoint that arrives before the WebView is ready is not lost.
 */
object PushBridge {

    private var listener: ((String, JSONObject) -> Unit)? = null
    private val pending = ArrayDeque<Pair<String, JSONObject>>()

    @Synchronized
    fun setListener(l: (String, JSONObject) -> Unit) {
        listener = l
        while (pending.isNotEmpty()) {
            val (e, d) = pending.removeFirst()
            l(e, d)
        }
    }

    @Synchronized
    fun clearListener() {
        listener = null
    }

    @Synchronized
    private fun emit(event: String, data: JSONObject) {
        val l = listener
        if (l != null) l(event, data) else pending.addLast(event to data)
    }

    fun emitEndpoint(endpoint: String, pubKey: String?, auth: String?) {
        emit("endpointChanged", JSONObject().apply {
            put("endpoint", endpoint)
            put("p256dh", pubKey ?: JSONObject.NULL)
            put("auth", auth ?: JSONObject.NULL)
        })
    }

    fun emitUnregistered() = emit("unregistered", JSONObject())

    fun emitError(reason: String) =
        emit("registrationFailed", JSONObject().put("reason", reason))
}

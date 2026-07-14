package de.quavon.jackpoll.push

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Capacitor bridge exposing UnifiedPush to the web app. The web layer:
 *   1. calls `register()` (returns an outcome: REGISTERING / NEEDS_PICKER /
 *      NEEDS_DISTRIBUTOR),
 *   2. listens for `endpointChanged` and POSTs {endpoint, keys:{p256dh, auth}}
 *      to the backend (same shape as a browser PushSubscription),
 *   3. shows a picker via `listDistributors()` + `pickDistributor()` when asked,
 *   4. can `unregister()` and read `getStatus()` for the debug page.
 */
@CapacitorPlugin(name = "UnifiedPush")
class PushBridgePlugin : Plugin() {

    override fun load() {
        PushBridge.setListener { event, data ->
            notifyListeners(event, JSObject.fromJSONObject(data))
        }
    }

    override fun handleOnDestroy() {
        PushBridge.clearListener()
    }

    @PluginMethod
    fun register(call: PluginCall) {
        val outcome = PushManager.register(context)
        call.resolve(JSObject().put("outcome", outcome.name))
    }

    @PluginMethod
    fun unregister(call: PluginCall) {
        PushManager.unregister(context)
        call.resolve()
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        call.resolve(JSObject.fromJSONObject(PushManager.status(context)))
    }

    @PluginMethod
    fun listDistributors(call: PluginCall) {
        val list = PushManager.distributors(context)
        call.resolve(JSObject().put("distributors", list.joinToString(",")))
    }

    @PluginMethod
    fun pickDistributor(call: PluginCall) {
        val distributor = call.getString("distributor")
        if (distributor.isNullOrBlank()) {
            call.reject("distributor is required")
            return
        }
        PushManager.useDistributor(context, distributor)
        call.resolve()
    }
}

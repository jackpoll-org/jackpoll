package de.quavon.jackpoll.push

import android.Manifest
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * Capacitor bridge exposing UnifiedPush to the web app. The web layer:
 *   1. calls `register()` (returns an outcome: REGISTERING / NEEDS_PICKER /
 *      NEEDS_DISTRIBUTOR / NEEDS_PERMISSION); with `askPermission` it first
 *      asks for POST_NOTIFICATIONS (Android 13+),
 *   2. listens for `endpointChanged` and POSTs {endpoint, keys:{p256dh, auth}}
 *      to the backend (same shape as a browser PushSubscription),
 *   3. shows a picker via `listDistributors()` + `pickDistributor()` when asked,
 *   4. can `unregister()` and read `getStatus()` for the debug page.
 */
@CapacitorPlugin(
    name = "UnifiedPush",
    permissions = [
        Permission(alias = PushBridgePlugin.NOTIFICATIONS, strings = [Manifest.permission.POST_NOTIFICATIONS]),
    ],
)
class PushBridgePlugin : Plugin() {

    companion object {
        const val NOTIFICATIONS = "notifications"
    }

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
        if (call.getBoolean("askPermission", false) == true && !notificationsEnabled()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                requestPermissionForAlias(NOTIFICATIONS, call, "notificationPermissionResult")
            } else {
                resolveNeedsPermission(call)
            }
            return
        }
        resolveRegister(call)
    }

    @PermissionCallback
    private fun notificationPermissionResult(call: PluginCall) {
        if (notificationsEnabled()) resolveRegister(call) else resolveNeedsPermission(call)
    }

    private fun notificationsEnabled() = NotificationManagerCompat.from(context).areNotificationsEnabled()

    private fun resolveNeedsPermission(call: PluginCall) {
        call.resolve(JSObject().put("outcome", "NEEDS_PERMISSION"))
    }

    private fun resolveRegister(call: PluginCall) {
        val outcome = PushManager.register(context, call.getString("vapid"))
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
        PushManager.useDistributor(context, distributor, call.getString("vapid"))
        call.resolve()
    }
}

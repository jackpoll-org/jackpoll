package de.quavon.jackpoll

import android.content.Context
import android.net.Uri
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Switches the self-host instance the app is bound to. Only the configured
 * instance's host stays inside the WebView (see MainActivity.load); every other
 * host opens in the external browser. A plain cross-origin navigation to a new
 * instance would therefore leave the app, so the web layer calls `switchTo()`
 * instead: it stores the URL and recreates the activity, which boots the bridge
 * with the new instance as its own origin.
 */
@CapacitorPlugin(name = "Instance")
class InstancePlugin : Plugin() {

    companion object {
        /** Same store and key @capacitor/preferences uses on Android. */
        const val PREFS_NAME = "CapacitorStorage"
        const val KEY_INSTANCE_URL = "instance_url"
        const val DEFAULT_INSTANCE_URL = "https://app.jackpoll.org"
    }

    @PluginMethod
    fun switchTo(call: PluginCall) {
        val url = call.getString("url")
        val uri = url?.let { Uri.parse(it) }
        if (uri == null || uri.scheme != "https" || uri.host.isNullOrEmpty()) {
            call.reject("An https instance URL is required")
            return
        }
        val saved = context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_INSTANCE_URL, url)
            .commit()
        if (!saved) {
            call.reject("Could not store the instance URL")
            return
        }
        call.resolve()
        activity.runOnUiThread { activity.recreate() }
    }
}

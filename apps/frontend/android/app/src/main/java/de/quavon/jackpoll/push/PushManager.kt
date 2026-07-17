package de.quavon.jackpoll.push

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import org.json.JSONObject
import org.unifiedpush.android.connector.UnifiedPush

/**
 * Central UnifiedPush controller shared by both flavors. Implements the
 * distributor selection policy:
 *
 *  1. If a distributor is already chosen and acknowledged → (re)register.
 *  2. Else prefer an EXTERNAL distributor (ntfy, NextPush, …):
 *       - exactly one installed  → use it automatically,
 *       - several installed       → ask the UI to show a picker.
 *  3. Else fall back to the flavor default (Play: Embedded FCM; F-Droid: none →
 *     tell the UI to prompt the user to install a distributor).
 *
 * The resulting endpoint + Web Push keys are persisted and pushed to the web
 * layer via [PushBridge]; the web app registers them with the backend exactly
 * like a browser PushSubscription.
 */
object PushManager {

    private const val TAG = "PushManager"
    private const val PREFS = "jackpoll_push"
    const val INSTANCE = "default"

    // Outcomes the UI/bridge reacts to.
    enum class Outcome { REGISTERING, NEEDS_PICKER, NEEDS_DISTRIBUTOR, UNSUPPORTED }

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun externalDistributors(ctx: Context): List<String> =
        UnifiedPush.getDistributors(ctx).filter { it != ctx.packageName }

    /**
     * Begin/refresh registration. Returns the immediate outcome for the UI.
     *
     * [vapid] is the backend's VAPID public key (GET /me/devices/web-push-key).
     * The Embedded FCM distributor needs it to build an RFC 8291/8292 Web Push
     * subscription — without it, registration fails with VAPID_REQUIRED.
     * External distributors (ntfy, …) ignore it.
     */
    fun register(ctx: Context, vapid: String? = null): Outcome {
        // 1. Already have an acknowledged distributor → just (re)register.
        val current = UnifiedPush.getAckDistributor(ctx)
        if (current != null) {
            UnifiedPush.register(ctx, INSTANCE, vapid = vapid)
            return Outcome.REGISTERING
        }

        // 2. Prefer external distributors.
        val external = externalDistributors(ctx)
        when {
            external.size == 1 -> {
                UnifiedPush.saveDistributor(ctx, external.first())
                UnifiedPush.register(ctx, INSTANCE, vapid = vapid)
                return Outcome.REGISTERING
            }
            external.size > 1 -> return Outcome.NEEDS_PICKER
        }

        // 3. Flavor fallback (Play: embedded FCM; F-Droid: none).
        return if (PushFlavor.ensureFallbackDistributor(ctx)) {
            UnifiedPush.register(ctx, INSTANCE, vapid = vapid)
            Outcome.REGISTERING
        } else {
            Outcome.NEEDS_DISTRIBUTOR
        }
    }

    /** Explicitly pick a distributor (from the UI picker) and register. */
    fun useDistributor(ctx: Context, distributor: String, vapid: String? = null) {
        UnifiedPush.saveDistributor(ctx, distributor)
        UnifiedPush.register(ctx, INSTANCE, vapid = vapid)
    }

    /** Stop notifications and forget the distributor. */
    fun unregister(ctx: Context) {
        try {
            UnifiedPush.unregister(ctx, INSTANCE)
        } catch (t: Throwable) {
            Log.w(TAG, "unregister failed", t)
        }
        UnifiedPush.forceRemoveDistributor(ctx)
        prefs(ctx).edit().clear().apply()
    }

    /** List installed distributors (package ids) for the picker. */
    fun distributors(ctx: Context): List<String> = UnifiedPush.getDistributors(ctx)

    // ── Endpoint persistence (written by the receiver) ────────────────────

    fun storeEndpoint(ctx: Context, endpoint: String, pubKey: String?, auth: String?) {
        prefs(ctx).edit()
            .putString("endpoint", endpoint)
            .putString("pubkey", pubKey)
            .putString("auth", auth)
            .apply()
    }

    fun clearEndpoint(ctx: Context) = prefs(ctx).edit().clear().apply()

    /** Current status as JSON for the debug page / onboarding UI. */
    fun status(ctx: Context): JSONObject {
        val p = prefs(ctx)
        val endpoint = p.getString("endpoint", null)
        return JSONObject().apply {
            put("registered", endpoint != null)
            put("distributor", UnifiedPush.getAckDistributor(ctx) ?: JSONObject.NULL)
            put("hasEmbeddedFallback", PushFlavor.hasEmbeddedFallback)
            put("installedDistributors", distributors(ctx).joinToString(","))
            put("endpoint", endpoint ?: JSONObject.NULL)
            put("pubKey", p.getString("pubkey", null) ?: JSONObject.NULL)
            put("auth", p.getString("auth", null) ?: JSONObject.NULL)
        }
    }
}

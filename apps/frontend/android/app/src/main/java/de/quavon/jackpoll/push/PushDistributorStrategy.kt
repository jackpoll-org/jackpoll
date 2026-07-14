package de.quavon.jackpoll.push

import android.content.Context

/**
 * Flavor-specific distributor policy. Both flavors share the same registration
 * flow (see [PushManager]); they only differ in whether an in-app fallback
 * distributor exists:
 *
 *  - play   → an Embedded FCM distributor is bundled, so we can always fall back
 *             to it when no external distributor (ntfy, NextPush, …) is present
 *             AND Google Play Services are available on the device.
 *  - fdroid → NO bundled distributor and NO Google dependency. If the user has
 *             no external distributor installed we surface an onboarding prompt
 *             instead of silently falling back.
 *
 * The concrete `object PushFlavor : PushDistributorStrategy` is provided by the
 * `src/play` and `src/fdroid` source sets.
 */
interface PushDistributorStrategy {

    /** True only for the Play build (bundled Embedded FCM distributor). */
    val hasEmbeddedFallback: Boolean

    /**
     * Called when [PushManager] could not resolve a usable distributor after
     * trying the saved/default one. Play may register its embedded distributor
     * here; F-Droid returns false so the UI can prompt the user to install one.
     *
     * @return true if a distributor was made available, false otherwise.
     */
    fun ensureFallbackDistributor(context: Context): Boolean
}

package de.quavon.jackpoll.push

import android.content.Context

/**
 * F-DROID flavor: 100% FLOSS. No bundled distributor, no Google Play Services.
 * When no external distributor (ntfy, NextPush, …) is installed there is nothing
 * to fall back to — [PushManager] surfaces an onboarding prompt via the bridge
 * instead, guiding the user to install one.
 */
object PushFlavor : PushDistributorStrategy {

    override val hasEmbeddedFallback: Boolean = false

    override fun ensureFallbackDistributor(context: Context): Boolean = false
}

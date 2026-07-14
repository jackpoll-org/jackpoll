package de.quavon.jackpoll.push

import android.content.Context
import android.util.Log
import org.unifiedpush.android.connector.UnifiedPush

/**
 * PLAY flavor: an Embedded FCM distributor is bundled. External distributors are
 * still preferred (see [PushManager]); the embedded one is only used as a
 * fallback when nothing else is installed and Google Play Services are present.
 */
object PushFlavor : PushDistributorStrategy {

    private const val TAG = "PushFlavor/play"

    override val hasEmbeddedFallback: Boolean = true

    override fun ensureFallbackDistributor(context: Context): Boolean {
        // The embedded distributor registers itself as an in-app distributor
        // (its receiver is declared in src/play AndroidManifest). Selecting our
        // own application id as the distributor routes through Embedded FCM.
        return try {
            val self = context.packageName
            val available = UnifiedPush.getDistributors(context)
            if (available.contains(self)) {
                UnifiedPush.saveDistributor(context, self)
                Log.i(TAG, "Falling back to bundled Embedded FCM distributor")
                true
            } else {
                Log.w(TAG, "Embedded distributor not available (Play Services missing?)")
                false
            }
        } catch (t: Throwable) {
            Log.e(TAG, "Embedded fallback failed", t)
            false
        }
    }
}

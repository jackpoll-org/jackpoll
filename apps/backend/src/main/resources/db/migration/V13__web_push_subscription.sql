-- Web Push (PWA) browser subscriptions reuse the device_tokens table (#74):
-- platform = 'web', token = the push endpoint URL, plus the subscription's
-- ECDH public key (p256dh) and auth secret needed to encrypt the payload.
-- Both are null for native (FCM/APNs) tokens.
ALTER TABLE public.device_tokens ADD COLUMN p256dh varchar(255);
ALTER TABLE public.device_tokens ADD COLUMN auth varchar(255);

# Credentials directory

Do **not** store Firebase Admin / FCM V1 service-account JSON, private keys, or `.p12` files in this project tree.

- FCM for production Android push is configured in Expo / EAS (FCM V1), not read from this folder at app runtime.
- Keep service-account keys in a password manager or OS private vault outside the repo (example location on this Mac: `~/Library/Application Support/QRShop-private/`).
- iOS signing materials should live in EAS credentials remote storage when possible.

If you need to re-upload an FCM V1 key to Expo, download a fresh key from Google Cloud Console and upload it in the Expo dashboard — do not commit it here.

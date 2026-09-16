# QR Shop — Mobile App (`qr-app`)

Expo / React Native app for QR Menu Myanmar members. Customers sign in with their Odoo credentials, browse the curated "QR App" catalog with membership pricing, order for delivery, redeem monthly coupons, and get push alerts for new arrivals and sales.

- Bundle / package id: `com.qrshop.myanmar` · scheme `qrapp` · EAS project `776d0c6d-e886-4053-9dba-89fa5c3bef58` (owner `serkevin`)
- Backend: [`../qr-shop-api`](../qr-shop-api/README.md) · [API reference](../qr-shop-api/docs/API.md)
- Store: Play `com.qrshop.myanmar` · App Store id `6800218923`

---

## Table of contents

1. [Stack](#stack)
2. [Project layout](#project-layout)
3. [Local development](#local-development)
4. [Environment variables](#environment-variables)
5. [Navigation & screens](#navigation--screens)
6. [State management (contexts)](#state-management-contexts)
7. [API layer & failover](#api-layer--failover)
8. [Notifications](#notifications)
9. [Feature notes](#feature-notes)
10. [Theming, language, fonts](#theming-language-fonts)
11. [Config plugins](#config-plugins)
12. [Build & release](#build--release)
13. [Troubleshooting](#troubleshooting)

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Expo SDK `54`, React Native `0.81`, React `19.1`, **New Architecture** on, **React Compiler** on |
| Routing | `expo-router` 6 (file-based, typed routes) |
| UI | `react-native-paper` 5 (MD3) + NativeWind 4 / Tailwind 3 utility classes |
| Animation | `react-native-reanimated` 4 + `react-native-worklets` |
| State | React context + `AsyncStorage`; `expo-secure-store` mirror for saved login |
| Networking | `fetch` with multi-host failover, Cloudflare DoH warm-up on Android |
| Notifications | `expo-notifications` (Expo Push / FCM V1) + 30 s in-app polling |
| Analytics | `@react-native-firebase/analytics` (native), `@vercel/analytics` (web only) |
| Media | `expo-image`, `expo-image-picker` (payment screenshot, currently hidden) |
| Fonts | Noto Sans Myanmar (`@expo-google-fonts/noto-sans-myanmar`) |
| Tooling | TypeScript 5.9, ESLint (`eslint-config-expo`), EAS CLI ≥ 16 |

Path alias: `@/*` → project root (`tsconfig.json`).

---

## Project layout

```
qr-app/
├── app/                      # expo-router screens (see route map)
│   ├── _layout.tsx           # Providers + root Stack
│   ├── index.tsx             # Splash / entry redirect
│   ├── welcome.tsx, login.tsx
│   ├── (tabs)/               # Products · Cart · Orders · Account
│   ├── product/[id].tsx, order/[id].tsx
│   ├── checkout.tsx, addresses.tsx, notifications.tsx, change-password.tsx
│   └── modal.tsx             # Expo template leftover (unused)
├── components/               # UI building blocks
│   ├── products/  (product-card, category-list, product-ribbon, skeletons)
│   ├── checkout/  (address-section, add-address-modal, township-search)
│   ├── address/   (address-form-*, township-picker, address-display-text)
│   ├── orders/    (order-card-skeleton)
│   ├── ui/        (icon-symbol, collapsible)
│   └── *.tsx      (force-update-modal, offline-notice, server-down-notice,
│                   notification-bootstrap, membership-upgrade-modal, app-toast, …)
├── contexts/                 # auth, cart, language, theme, notification, network, app-status
├── services/                 # API clients + device services (see API layer)
├── hooks/                    # useAuthenticatedApi, useReorder, useResponsive, …
├── constants/                # api, translations, colors, fonts, townships data
├── types/                    # product, membership, address
├── utils/                    # version compare, product sync/text, address payload, quit-app
├── plugins/                  # Expo config plugins (Firebase iOS, Play compliance, OkHttp DoH)
├── scripts/                  # build-local-aab.sh, build-local-apk.sh, reset-project.js
├── assets/                   # icons, splash, images
├── app.json, eas.json, .env.example
├── google-services.json, GoogleService-Info.plist   # Firebase (project qr-shop-myanmar)
├── credentials/, credentials.json                   # signing / FCM V1 (secret, git-ignored)
└── android/                  # Prebuilt native project (keystore.properties for local AAB)
```

---

## Local development

```bash
npm install
cp .env.example .env            # set EXPO_PUBLIC_API_BASE_URL (+ fallback)
npx expo start                  # Expo Go / dev client
npm run android                 # expo run:android (native build)
npm run ios                     # expo run:ios
npm run lint
```

Notes

- **Expo Go** is fine for UI work but cannot receive remote push and skips notification bootstrap (`Constants.appOwnership === 'expo'`). Use a dev client (`eas build --profile development`) or a release APK to test push.
- Point at a local backend with `EXPO_PUBLIC_API_BASE_URL=http://<lan-ip>:10000`. Env vars prefixed `EXPO_PUBLIC_` are inlined at bundle time; restart Metro with `--clear` after changing them.
- The app stores the last host that answered in AsyncStorage (`qrshop.preferredApiBase`). If you switch backends and the app keeps hitting the old one, clear app storage or sign out/in.

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `EXPO_PUBLIC_API_BASE_URL` | yes | Primary API. Throws at startup if missing. Production: `https://www.qrshop.online`. Dev/preview EAS profiles: `https://qr-shop-app-backend.vercel.app`. |
| `EXPO_PUBLIC_API_FALLBACK_URL` | no | Secondary API used automatically when the primary is unreachable (`https://qrshopmyanmar.netlify.app`). |
| `ORG_GRADLE_JVMARGS` | build only | Gradle heap for local/EAS Android builds (set in `eas.json`). |
| `EAS_BUILD_DISABLE_EXPO_DOCTOR_STEP` | build only | Set by `scripts/build-local-apk.sh`. |
| `JAVA_HOME`, `ANDROID_HOME` | build only | Used by `scripts/build-local-aab.sh`. |

Per-profile values live in `eas.json` → `build.<profile>.env`; `.env` is for local Metro runs.

---

## Navigation & screens

### Root (`app/_layout.tsx`)

Provider order (outer → inner):

`SafeAreaProvider` → `ThemeProvider` → `LanguageProvider` → `NetworkProvider` → `AppStatusProvider` → `AuthProvider` → `NotificationProvider` → `CartProvider` → `RootNavigator`

Always-mounted overlays: `NotificationBootstrap`, `OfflineNotice`, `ServerDownNotice`, `ForceUpdateModal`. Fonts (Noto Sans Myanmar) load before the navigator renders; Paper and React Navigation themes are derived from the theme context.

### Entry gating (`app/index.tsx`)

1. Wait for auth / language / theme to be ready (min splash 1.2 s).
2. Signed in → `prefetchSessionBootstrap(token)` (products, categories, membership, coupons, orders) → `/(tabs)`.
3. Welcome not seen → `/welcome`. Otherwise → `/login`.

`app/(tabs)/_layout.tsx` redirects to `/login` whenever `user` is null, so every tab is auth-gated.

### Route map

| Route | File | Screen |
|-------|------|--------|
| `/` | `app/index.tsx` | Splash + redirect |
| `/welcome` | `app/welcome.tsx` | Onboarding; "Get started" sets the welcome flag → `/login` |
| `/login` | `app/login.tsx` | Email **or phone** + password; "save password"; lockout countdown UX; language chip |
| `/(tabs)` | `app/(tabs)/index.tsx` | **Products**: search, category chips (incl. *Just for you*), grid/list toggle, add to cart |
| `/(tabs)/cart` | `app/(tabs)/cart.tsx` | **Cart**: quantities, delivery fee line, checkout CTA |
| `/(tabs)/orders` | `app/(tabs)/orders.tsx` | **Orders**: list with status/date filters + search, reorder |
| `/(tabs)/account` | `app/(tabs)/account.tsx` | **Account**: membership card + coupon code copy, theme & language, addresses, notifications, change password, upgrade request, sign out, network/status test toggles |
| `/product/:id` | `app/product/[id].tsx` | Product detail: image, ribbon, (member) price, description, similar products, qty + add |
| `/checkout` | `app/checkout.tsx` | Address, coupon code, payment (COD; wire transfer UI commented out), preferred date + delivery notes, place order |
| `/addresses` | `app/addresses.tsx` | List / add / edit / delete delivery addresses (township picker) |
| `/notifications` | `app/notifications.tsx` | Product & coupon alerts; marks all seen; tap → product |
| `/change-password` | `app/change-password.tsx` | Current / new / confirm; signs out after success |
| `/order/:id` | `app/order/[id].tsx` | Order detail: status, lines, shipping, *delivering now* / *coming later*, reorder |
| `/modal` | `app/modal.tsx` | Expo template placeholder — safe to delete |

Deep links: scheme `qrapp://`. Notification taps push `/product/:id` (product) or `/notifications` (coupon / test).

---

## State management (contexts)

| Context | Hook | State | Persistence | Notes |
|---------|------|-------|-------------|-------|
| `auth-context.tsx` | `useAuth` | `user`, `token`, `isLoading` | AsyncStorage `qr-app-session`, `qr-app-token` | `signIn` → login API → save → register push → `login_success` analytics. `signOut` → unregister push → logout API → clear session, cart, bootstrap cache (saved login is kept). |
| `cart-context.tsx` | `useCart` | `items`, `productItems`, `totalItems`, `totalAmount`, `deliveryFeeAmount`, `isDeliveryFeeLoading` | AsyncStorage `qr-app-cart` | `addToCart`, `removeFromCart`, `updateQuantity`, `clearCart`, `syncPricesFromProducts`, `syncDeliveryFee` (delivery line id `__delivery_fee__`). Cart is client-only; server receives `items` at checkout. |
| `language-context.tsx` | `useLanguage` | `language` (`my` \| `en`), `isReady` | `qr-app-language-preference` (default `my`) | `t(key)` translations, `fs()` font scale (0.9× for Myanmar), `lh()` line-height guard |
| `theme-context.tsx` | `useThemeMode`, `useAppColors` | `preference` (`system` \| `light` \| `dark`), `theme`, `isDark` | `qr-app-theme-preference` | Feeds Paper + Navigation themes |
| `notification-context.tsx` | `useNotifications` | `notifications`, `unreadCount`, `isLoading`, `error` | `qr-app-notifications-last-seen` | 30 s poll + refresh on foreground; local notification for new items; registers push token with language |
| `network-context.tsx` | `useNetwork` | `isOnline`, `simulateOffline` | — | NetInfo reachability URL = `{apiBase}/api/app-config`. Online = `isConnected !== false` (ignores `isInternetReachable`, unreliable on Myanmar ISPs). |
| `app-status-context.tsx` | `useAppStatus` | `forceUpdate`, `serverDown`, store URLs | — | Polls `/api/app-config` every 60 s; `isVersionBelow(expo.version, min)`; server-down after 3 consecutive 5xx / network failures |

---

## API layer & failover

### Base URL selection (`constants/api.ts`, `services/api-client.ts`)

1. Candidates = unique `[preferred (AsyncStorage), EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_API_FALLBACK_URL]`.
2. A request tries each candidate in order. Probe timeout is short (`API_FAILOVER_PROBE_MS = 4000`, up to 8000 for the preferred host) while other hosts remain; the last host gets the full `60000` ms timeout and one same-host retry for GET/HEAD.
3. First host that responds becomes *preferred* (`noteApiBaseSuccess`) and is persisted.
4. On Android, `warmCloudflareDoh()` primes DNS-over-HTTPS before the first fetch (native side patched by the OkHttp plugin, see below).
5. HTTP 502/503/504 or repeated network failures emit a server-down event (`server-status-events.ts`) consumed by `AppStatusProvider`.

### Auth header

`apiRequest(path, { token })` adds `Authorization: Bearer <token>`. `orderRequest` (`services/order-client.ts`) does the same for `FormData` checkout without setting `Content-Type`. `useAuthenticatedApi()` wraps this for screens.

### Endpoint map

| Method | Path | Function | File |
|--------|------|----------|------|
| POST | `/api/auth/login` | `loginWithApi` | `services/auth-api.ts` |
| POST | `/api/auth/logout` | `logoutFromApi` | `services/auth-api.ts` |
| POST | `/api/auth/change-password` | `changePasswordApi` | `services/auth-api.ts` |
| GET | `/api/products` | `fetchProducts` | `services/product-api.ts` |
| GET | `/api/products/search` | `searchProducts` | `services/product-api.ts` |
| GET | `/api/products/prices` | `fetchProductPrices` | `services/product-api.ts` |
| GET | `/api/products/:id` | `fetchProductById` | `services/product-api.ts` |
| GET | `/api/products/:id/image` | `getProductImageUri` (URL builder) | `types/product.ts` |
| GET | `/api/categories` | `fetchCategories` | `services/product-api.ts` |
| GET | `/api/customer/profile` | `fetchCustomerProfile`, `fetchPartnerTags` | `services/customer-api.ts` |
| GET | `/api/membership` | `fetchMembership` | `services/membership-api.ts` |
| GET | `/api/membership/coupons` | `fetchMembershipCoupons` | `services/membership-api.ts` |
| GET / POST | `/api/membership/application` | `fetchMembershipApplication`, `submitMembershipUpgradeRequest` | `services/membership-upgrade.ts` |
| GET | `/api/delivery-fee` | `fetchDeliveryFeeQuote` | `services/delivery-fee-api.ts` |
| GET | `/api/addresses`, `/api/addresses/meta` | `fetchAddresses`, `fetchAddressMeta` | `services/address-api.ts` |
| POST / PUT / DELETE | `/api/addresses[/:id]` | `createAddress`, `updateAddress`, `deleteAddress` | `services/address-api.ts` |
| POST | `/api/orders/checkout` | `checkoutOrder` (FormData) | `services/order-api.ts` |
| GET | `/api/orders`, `/api/orders/:id` | `fetchOrders`, `fetchOrderById` | `services/order-api.ts` |
| POST | `/api/orders/:id/reorder` | `reorderPreviousOrder` | `services/order-api.ts` |
| GET | `/api/notifications` | `fetchNotifications` | `services/notification-api.ts` |
| POST / DELETE | `/api/notifications/register-token` | `registerPushToken`, `unregisterPushToken` | `services/notification-api.ts` |
| POST | `/api/notifications/test-push` | `sendTestPush` | `services/notification-api.ts` |
| GET | `/api/notifications/push-status` | `fetchPushStatus` | `services/notification-api.ts` |
| GET | `/api/app-config` | `fetchAppConfig` | `services/app-config.ts` |

### Support modules in `services/`

| File | Role |
|------|------|
| `catalog-bootstrap.ts` | Prefetch products / categories / membership / coupons / orders during splash; in-memory cache for instant first render |
| `catalog-events.ts` | Pub/sub `requestCatalogRefresh()` used after push events |
| `product-preview-cache.ts` | Product map so detail screens open instantly from list data |
| `device-notifications.ts` | expo-notifications setup, channels, permission, token retry, local notify, tap routing |
| `push-registration.ts` | `registerPushForAuthSession` after login |
| `saved-login.ts` | "Save password" (AsyncStorage + SecureStore mirror) |
| `analytics.ts` | Firebase `app_open`, `login_success` |
| `cloudflare-doh.ts` | JS-side DoH warm-up (`1.1.1.1` JSON API) |
| `network-error.ts` | Localised network / invalid-response messages |
| `server-status-events.ts` | Failure streak → server-down banner |
| `membership-upgrade.ts` | Pending upgrade request in AsyncStorage + sync with Odoo application |

---

## Notifications

Two independent paths:

**1. Closed-app push (Expo Push / FCM V1)** — `NotificationBootstrap` + `services/device-notifications.ts`

- Skipped in Expo Go. Lazy-imports `expo-notifications`.
- Android channel `default` ("QR Shop Alerts", importance MAX). Foreground handler shows banner + list + sound.
- Permission → `getExpoPushTokenAsync({ projectId })` with retry backoff `[0, 1, 3, 8, 15] s`.
- Token is POSTed to `/api/notifications/register-token` with the current language on login, when language/token change, and on foreground. Logout DELETEs it.
- The backend (triggered by Odoo webhooks) sends the actual push. Requires a real APK / Play / TestFlight build.

**2. In-app alerts while open** — `NotificationProvider`

- Polls `GET /api/notifications` every 30 s and on foreground.
- New ids → `presentLocalNotification()` + catalog refresh so ribbons/prices update.
- `unreadCount` badge is derived from the last-seen timestamp.

**Tap handling** — `addNotificationNavigationListeners`: `data.type === 'product'` → `/product/:id`; coupon / test → `/notifications`. Cold-start taps are handled via the last notification response.

Push code and webhook URLs are considered locked (see `.cursor/rules/push-notifications.mdc`); re-test on a real build after any change.

---

## Feature notes

| Feature | Implementation |
|---------|----------------|
| Catalog | `ProductsScreen` uses `fetchProducts` (pages of 75), `fetchCategories`, `searchProducts`; *Just for you* appears when partner tags match product tags (`productMatchesPartnerTags`). While focused, `fetchProductPrices?version=` is polled every 30 s and `utils/product-sync.ts` detects price/ribbon changes. |
| Ribbons | `Product.ribbon` from API → `components/products/product-ribbon.tsx` badge (colours from Odoo). |
| Membership pricing | Every product call sends the JWT; the API swaps in Pro/Premium pricelist prices. Account shows tier, dates, remaining tickets, current coupon (copy to clipboard). |
| Upgrade request | `MembershipUpgradeModal` → `POST /api/membership/application` (`pro` \| `premium`); pending state cached locally until Odoo status changes. |
| Cart & delivery fee | Local cart; `syncDeliveryFee` quotes `GET /api/delivery-fee` for the selected address / zip. The server recomputes the fee at checkout; client delivery lines are ignored. |
| Checkout | Address (or add inline with township search), optional coupon, COD, preferred delivery date (`DatePickerField`), delivery notes → `checkoutOrder` FormData → success toast/celebration → Orders tab. Wire-transfer + screenshot upload + KPay QR image are implemented but commented out in `app/checkout.tsx` (plugin permission string remains in `app.json`). |
| Orders | List with derived `delivery_status`, filters; detail shows *delivering now* / *coming later*. Reorder via `useReorder` (fills cart client-side). |
| Addresses | Child delivery partners; `constants/townships.data.json` powers the township/postal picker; `utils/address.ts` builds payloads and resolves `state_id` from `/api/addresses/meta`. |
| Login | Email or Myanmar phone + password (no OTP). `LoginApiError` exposes lockout details for the countdown UI. "Save password" mirrors to SecureStore. |
| Force update | `ForceUpdateModal` blocks when `expo.version` < platform minimum from `/api/app-config`; buttons open store URLs. |
| Offline / server down | `OfflineNotice` (NetInfo) and `ServerDownNotice` (5xx streak); Account has QA toggles to simulate both. Android can exit via `utils/quit-app.ts`. |
| Analytics | Firebase `app_open` on launch, `login_success` after sign-in; Vercel Analytics on web only. |

---

## Theming, language, fonts

- Palette in `constants/app-colors.ts` (charcoal / teal, light + dark). `useAppColors()` returns the active set; legacy `constants/theme.ts` maps it to the Expo template `Colors`.
- Language default is **Myanmar** (`my`). All UI strings live in `constants/translations.ts` (`en` / `my` trees); use `t('key')`.
- Noto Sans Myanmar is loaded in `RootLayout` and applied to Paper when `language === 'my'`; `constants/text-input.ts` has separate metrics for Latin vs Myanmar to avoid glyph clipping.
- Dark mode: system / light / dark toggle on Account; persisted.

---

## Config plugins

| Plugin | What it does | Why |
|--------|--------------|-----|
| `plugins/with-rnfb-ios-fix.js` | Forces static linking for `RNFBApp` / `RNFBAnalytics`, sets `$RNFirebaseAsStaticFramework = true`, allows non-modular includes in `post_install` | React Native Firebase with `useFrameworks: static` on iOS |
| `plugins/with-android-play-compliance.js` | Enables minify in release, strips `android:screenOrientation` from activities, forces ML Kit barcode activity orientation to `unspecified` | Google Play large-screen / Android 16 orientation policy |
| `plugins/with-okhttp-doh.js` | Copies `DohDns.kt` + `DohOkHttpClientFactory.kt` into `com.qrshop.myanmar.network` and installs the factory in `MainApplication.onCreate` | Cloudflare DNS-over-HTTPS + HTTP/1.1 so carrier DNS in Myanmar cannot break API calls. ProGuard keep rules for this package are in `app.json`. |

`app.json` also enables ProGuard + resource shrinking in release and keeps Firebase / GMS classes.

---

## Build & release

### Versions (`app.json`)

| Field | Value | Bump when |
|-------|-------|-----------|
| `expo.version` | `1.4` | Every store release (compared against `/api/app-config` minimums) |
| `android.versionCode` | `22` | Every Play upload |
| `ios.buildNumber` | `17` | Every TestFlight / App Store upload |

`package.json` `version` (`1.3.0`) is not used by the stores.

### EAS profiles (`eas.json`)

| Profile | Output | API | Use |
|---------|--------|-----|-----|
| `development` | Dev client, internal | Vercel default domain | Day-to-day native debugging with push |
| `preview` | AAB, internal | Vercel default domain | Internal testers |
| `local-apk` | APK via `eas build --local`, lint skipped | `www.qrshop.online` + Netlify fallback | Sideload / Xiaomi GetApps / quick QA |
| `local-aab` | Store AAB via local Gradle | production APIs | Play upload without EAS cloud minutes |
| `production` | AAB + iOS (`m-medium`), `autoIncrement` | production APIs | Store releases |

Submit: Android `production` track; iOS `ascAppId` `6800218923`.

### Commands

```bash
npm run build:preview            # eas build --profile preview --platform all
npm run build:local:apk          # scripts/build-local-apk.sh → eas build --local --profile local-apk
npm run build:local:aab          # scripts/build-local-aab.sh → gradle :app:bundleRelease
eas build --profile production --platform all
eas submit --profile production --platform android|ios
```

`build-local-aab.sh` needs Android Studio's JDK and `android/keystore.properties` (copy from `.example`, git-ignored). Output bundles land in the project root (`build-<timestamp>.aab`).

### Store / signing assets (secret, never commit)

| File | Purpose |
|------|---------|
| `*.jks`, `android/keystore.properties` | Play upload keystore |
| `credentials.json`, `credentials/` | iOS distribution cert + provisioning profile, FCM V1 service account |
| `google-services.json`, `GoogleService-Info.plist` | Firebase config (project `qr-shop-myanmar`) |
| `play-internal-testers.csv` | Internal tester list |
| `com.xiaomi.getapps.signature.verification.apk*`, `xiaomi-upload/` | Xiaomi GetApps signature verification helpers |
| `privacy-policy.txt` | Published privacy policy text |

### Release order

1. Bump versions in `app.json`; build; upload; wait for the store to publish.
2. Only then raise `APP_MIN_IOS_VERSION` / `APP_MIN_ANDROID_VERSION` on the backend if a forced update is required.
3. Install the store build on a real device and verify: login, product list, checkout (COD), and a test push from Account → Notifications.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| App crashes at start with "EXPO_PUBLIC_API_BASE_URL is required" | `.env` missing or Metro cache stale → `npx expo start --clear` |
| Stuck on splash | Backend unreachable on all hosts; check `/api/app-config` in a browser; splash waits for bootstrap prefetch |
| Everyone sees "Update required" | Backend min version raised above the installed `expo.version` before the store build went live |
| No push on device | Expo Go, or permission denied, or token not registered (Account → Notifications → push status), or backend/Odoo webhook (see backend README) |
| Prices not member prices | Token expired (30 d) → sign out/in; or membership not Active in Odoo |
| Burmese text clipped | Use `fs()` / `lh()` from `useLanguage`; do not set fixed `lineHeight` on Myanmar text |
| Android network errors on some carriers | DoH plugin must be present after `expo prebuild`; check `MainApplication` includes `DohOkHttpClientFactory` |
| Local AAB fails | Missing `android/keystore.properties` or `JAVA_HOME` in `scripts/build-local-aab.sh` |

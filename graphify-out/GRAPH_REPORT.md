# Graph Report - qr-app  (2026-07-28)

## Corpus Check
- 100 files · ~33,966 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 664 nodes · 1378 edges · 63 communities (25 shown, 38 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `14ef696f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- expo-linking
- expo-system-ui
- @react-native-firebase/analytics
- @react-native-firebase/app
- react-native-qrcode-svg
- react-native-svg
- @vercel/analytics

## God Nodes (most connected - your core abstractions)
1. `useAppColors()` - 49 edges
2. `useLanguage()` - 45 edges
3. `useResponsive()` - 40 edges
4. `useAuth()` - 29 edges
5. `expo-router` - 20 edges
6. `formatPrice()` - 19 edges
7. `expo` - 16 edges
8. `AccountScreen()` - 16 edges
9. `ProductDetailScreen()` - 14 edges
10. `useThemeMode()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `CartTabIcon()` --calls--> `useCart()`  [EXTRACTED]
  app/(tabs)/_layout.tsx → contexts/cart-context.tsx
- `ProductsScreen()` --calls--> `useAuth()`  [EXTRACTED]
  app/(tabs)/index.tsx → contexts/auth-context.tsx
- `OrderCard()` --calls--> `formatPrice()`  [EXTRACTED]
  app/(tabs)/orders.tsx → types/product.ts
- `OrdersScreen()` --calls--> `useAuth()`  [EXTRACTED]
  app/(tabs)/orders.tsx → contexts/auth-context.tsx
- `RootLayout()` --indirect_call--> `trackAppOpen()`  [INFERRED]
  app/_layout.tsx → services/analytics.ts

## Import Cycles
- None detected.

## Communities (63 total, 38 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (73): ChangePasswordScreen(), styles, NotificationsScreen(), styles, useRelativeTime(), ProductDetailScreen(), styles, CartScreen() (+65 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (42): AddressesScreen(), styles, AddressDisplayText(), AddressDisplayTextProps, styles, addressFormFromAddress(), AddressFormValues, emptyAddressForm (+34 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (28): AccountScreen(), readAccountSeed(), styles, useNotifications(), AccountBootstrap, CatalogBootstrap, clearCatalogBootstrap(), clearSessionBootstrap() (+20 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (39): CheckoutScreen(), PaymentMethod, styles, AppColors, getStatusBadgeColors(), OrderDetailScreen(), styles, CartTabIcon() (+31 more)

### Community 4 - "Community 4"
Cohesion: 0.20
Nodes (16): RootLayout(), RootNavigator(), withBrandColors(), withBurmeseFonts(), AuthContext, AuthContextValue, AuthProvider(), isValidEmail() (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.15
Nodes (22): NotificationBootstrap(), describeNotification(), NotificationContext, NotificationContextValue, NotificationProvider(), CatalogRefreshListener, listeners, requestCatalogRefresh() (+14 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (20): AppEntryScreen(), LATIN_BUTTON_FONT, LoginScreen(), LOGO_DARK, LOGO_LIGHT, styles, KeyboardAwareScrollView, KeyboardAwareScrollViewProps (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (41): backgroundColor, foregroundImage, monochromeImage, adaptiveIcon, edgeToEdgeEnabled, googleServicesFile, package, permissions (+33 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (21): styles, ParallaxScrollView(), Props, styles, styles, ThemedText(), ThemedTextProps, ThemedView() (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (37): API_BASE_URL, apiBaseUrl, PAYMENT_CONFIG, dictionaries, en, interpolate(), Language, my (+29 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (25): eslint, eslint-config-expo, devDependencies, eslint, eslint-config-expo, tailwindcss, @types/react, typescript (+17 more)

### Community 11 - "Community 11"
Cohesion: 0.17
Nodes (18): AddressFormFieldsProps, addressFormFromCityPrefill(), styles, styles, TownshipPicker(), TownshipPickerProps, styles, TownshipSearch() (+10 more)

### Community 12 - "Community 12"
Cohesion: 0.15
Nodes (12): expo-env.d.ts, expo/tsconfig.base, .expo/types/**/*.ts, nativewind-env.d.ts, **/*.ts, **/*.tsx, compilerOptions, paths (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (11): babel-preset-expo, expo-notifications, expo-status-bar, dependencies, babel-preset-expo, expo-notifications, expo-status-bar, @react-native-community/netinfo (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (7): exampleDirPath, fs, oldDirs, path, readline, rl, root

### Community 15 - "Community 15"
Cohesion: 0.60
Nodes (5): decodeHtmlEntities(), getProductDescription(), getProductDescriptionSections(), htmlToPlainText(), normalizeDescriptionPart()

### Community 16 - "Community 16"
Cohesion: 0.50
Nodes (3): config, { getDefaultConfig }, { withNativeWind }

### Community 30 - "Community 30"
Cohesion: 0.09
Nodes (33): ProductsScreen(), readBootstrapSeed(), styles, ViewMode, CategoryList(), CategoryListProps, styles, prefetchCatalog() (+25 more)

### Community 33 - "Community 33"
Cohesion: 0.16
Nodes (12): AppColors, DATE_FILTERS, DateFilter, getDateThreshold(), getStatusBadgeColors(), Language, OrderCard(), OrdersScreen() (+4 more)

### Community 43 - "Community 43"
Cohesion: 0.50
Nodes (4): NetworkContext, NetworkContextValue, NetworkProvider(), resolveOnline()

## Knowledge Gaps
- **258 isolated node(s):** `name`, `slug`, `version`, `orientation`, `icon` (+253 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `expo-router` connect `Community 3` to `Community 0`, `Community 1`, `Community 2`, `Community 33`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 30`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
- **Why does `plugins` connect `Community 7` to `Community 3`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _258 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05892634207240949 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07878787878787878 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11587301587301588 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.06938775510204082 - nodes in this community are weakly interconnected._
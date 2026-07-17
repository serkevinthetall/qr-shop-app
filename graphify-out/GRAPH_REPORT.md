# Graph Report - .  (2026-07-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 635 nodes · 1476 edges · 56 communities (23 shown, 33 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.6)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e1cc8507`
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

## God Nodes (most connected - your core abstractions)
1. `useLanguage()` - 57 edges
2. `useAppColors()` - 57 edges
3. `useResponsive()` - 44 edges
4. `useAuth()` - 28 edges
5. `expo-router` - 20 edges
6. `formatPrice()` - 19 edges
7. `expo` - 16 edges
8. `AccountScreen()` - 16 edges
9. `useThemeMode()` - 16 edges
10. `CheckoutScreen()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `CartTabIcon()` --calls--> `useCart()`  [EXTRACTED]
  app/(tabs)/_layout.tsx → contexts/cart-context.tsx
- `TabLayout()` --indirect_call--> `HapticTab()`  [INFERRED]
  app/(tabs)/_layout.tsx → components/haptic-tab.tsx
- `TabLayout()` --calls--> `useLanguage()`  [EXTRACTED]
  app/(tabs)/_layout.tsx → contexts/language-context.tsx
- `TabLayout()` --calls--> `useAppColors()`  [EXTRACTED]
  app/(tabs)/_layout.tsx → contexts/theme-context.tsx
- `AccountScreen()` --calls--> `useAuth()`  [EXTRACTED]
  app/(tabs)/account.tsx → contexts/auth-context.tsx

## Import Cycles
- None detected.

## Communities (56 total, 33 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (71): ChangePasswordScreen(), ProductDetailScreen(), styles, CartScreen(), styles, ProductsScreen(), readBootstrapSeed(), styles (+63 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (40): AddressesScreen(), styles, AddressDisplayText(), AddressDisplayTextProps, styles, addressFormFromAddress(), AddressFormModal(), AddressFormModalProps (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (42): CheckoutScreen(), PaymentMethod, styles, AccountScreen(), readAccountSeed(), styles, AccountBootstrap, CatalogBootstrap (+34 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (39): plugins, AppColors, getStatusBadgeColors(), OrderDetailScreen(), styles, AppColors, DATE_FILTERS, DateFilter (+31 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (35): styles, LATIN_BUTTON_FONT, LoginScreen(), LOGO_DARK, LOGO_LIGHT, styles, CartTabIcon(), getAndroidTabBarStyle() (+27 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (37): NotificationsScreen(), styles, useRelativeTime(), NotificationBootstrap(), describeNotification(), NotificationContext, NotificationContextValue, NotificationProvider() (+29 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (32): AppEntryScreen(), RootNavigator(), withBrandColors(), withBurmeseFonts(), DatePickerField(), DatePickerFieldProps, formatDisplay(), parseIsoDate() (+24 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (34): backgroundColor, foregroundImage, monochromeImage, adaptiveIcon, edgeToEdgeEnabled, googleServicesFile, package, permissions (+26 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (19): styles, ParallaxScrollView(), Props, styles, styles, ThemedText(), ThemedTextProps, ThemedView() (+11 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (22): API_BASE_URL, apiBaseUrl, PAYMENT_CONFIG, dictionaries, en, interpolate(), Language, my (+14 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (25): eslint, eslint-config-expo, devDependencies, eslint, eslint-config-expo, tailwindcss, @types/react, typescript (+17 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (20): AddressFormFieldsProps, addressFormFromCityPrefill(), AddressFormValues, emptyAddressForm, styles, styles, TownshipPickerProps, styles (+12 more)

### Community 12 - "Community 12"
Cohesion: 0.15
Nodes (12): expo-env.d.ts, expo/tsconfig.base, .expo/types/**/*.ts, nativewind-env.d.ts, **/*.ts, **/*.tsx, compilerOptions, paths (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (10): babel-preset-expo, expo-linking, expo-system-ui, dependencies, babel-preset-expo, expo-linking, expo-system-ui, react-native-qrcode-svg (+2 more)

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (7): exampleDirPath, fs, oldDirs, path, readline, rl, root

### Community 15 - "Community 15"
Cohesion: 0.60
Nodes (5): decodeHtmlEntities(), getProductDescription(), getProductDescriptionSections(), htmlToPlainText(), normalizeDescriptionPart()

### Community 16 - "Community 16"
Cohesion: 0.50
Nodes (3): config, { getDefaultConfig }, { withNativeWind }

### Community 18 - "Community 18"
Cohesion: 0.67
Nodes (3): @react-navigation/elements, @react-navigation/native, @react-navigation/native

## Knowledge Gaps
- **241 isolated node(s):** `name`, `slug`, `version`, `orientation`, `icon` (+236 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `expo-router` connect `Community 3` to `Community 0`, `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 8`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `expo` connect `Community 7` to `Community 3`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `plugins` connect `Community 3` to `Community 7`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _241 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06275946275946276 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08345428156748912 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09863945578231292 - nodes in this community are weakly interconnected._
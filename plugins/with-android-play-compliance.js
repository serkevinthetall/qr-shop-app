const {
  createRunOncePlugin,
  withAndroidManifest,
  withGradleProperties,
} = require('expo/config-plugins');

const ML_KIT_BARCODE_ACTIVITY =
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

function upsertGradleProperty(modResults, key, value) {
  const existing = modResults.find(
    (item) => item.type === 'property' && item.key === key,
  );

  if (existing) {
    existing.value = value;
    return;
  }

  modResults.push({ type: 'property', key, value });
}

function withAndroidReleaseMinify(config) {
  return withGradleProperties(config, (cfg) => {
    // Expo SDK 54 template reads android.enableMinifyInReleaseBuilds (not enableProguardInReleaseBuilds).
    upsertGradleProperty(
      cfg.modResults,
      'android.enableMinifyInReleaseBuilds',
      'true',
    );
    return cfg;
  });
}

function ensureToolsNamespace(manifest) {
  if (!manifest.$) {
    manifest.$ = {};
  }

  if (!manifest.$['xmlns:tools']) {
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  }
}

function clearScreenOrientation(activity) {
  if (!activity?.$) {
    return;
  }

  if (activity.$['android:screenOrientation']) {
    delete activity.$['android:screenOrientation'];
  }
}

/**
 * Play Console (Android 16): remove portrait/resizability locks so large
 * screens are not stuck in forced portrait. Also override ML Kit's locked
 * barcode activity when that dependency is present in the merged manifest.
 */
function withAndroidPlayCompliance(config) {
  config = withAndroidReleaseMinify(config);

  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    ensureToolsNamespace(manifest);

    const application = manifest.application?.[0];
    if (!application) {
      return cfg;
    }

    const activities = application.activity || [];

    for (const activity of activities) {
      clearScreenOrientation(activity);
    }

    let mlKitActivity = activities.find(
      (activity) => activity?.$?.['android:name'] === ML_KIT_BARCODE_ACTIVITY,
    );

    if (!mlKitActivity) {
      mlKitActivity = {
        $: {
          'android:name': ML_KIT_BARCODE_ACTIVITY,
        },
      };
      activities.push(mlKitActivity);
      application.activity = activities;
    }

    mlKitActivity.$['android:screenOrientation'] = 'unspecified';
    const existingReplace = String(mlKitActivity.$['tools:replace'] || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (!existingReplace.includes('android:screenOrientation')) {
      existingReplace.push('android:screenOrientation');
    }

    mlKitActivity.$['tools:replace'] = existingReplace.join(',');

    return cfg;
  });
}

module.exports = createRunOncePlugin(
  withAndroidPlayCompliance,
  'with-android-play-compliance',
  '1.0.1',
);

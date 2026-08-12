const { createRunOncePlugin, withPodfile, withPodfileProperties } = require('expo/config-plugins');

const RNFB_STATIC_PODS = ['RNFBApp', 'RNFBAnalytics'];

/**
 * Expo SDK 54's expo-build-properties does not write ios.forceStaticLinking /
 * buildReactNativeFromSource. React Native Firebase still needs RNFB pods linked
 * as static libraries (or non-modular includes allowed) when useFrameworks=static.
 */
function withRnfbIosFix(config) {
  config = withPodfileProperties(config, (cfg) => {
    cfg.modResults['ios.forceStaticLinking'] = JSON.stringify(RNFB_STATIC_PODS);
    return cfg;
  });

  config = withPodfile(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (!contents.includes('$RNFirebaseAsStaticFramework')) {
      contents = `$RNFirebaseAsStaticFramework = true\n${contents}`;
    }

    const begin = '# @generated begin rnfb-non-modular-fix';
    if (!contents.includes(begin)) {
      const snippet = `
    ${begin}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
    # @generated end rnfb-non-modular-fix
`;

      if (!contents.includes('post_install do |installer|')) {
        throw new Error('with-rnfb-ios-fix: could not find post_install in Podfile');
      }

      contents = contents.replace(
        'post_install do |installer|',
        `post_install do |installer|${snippet}`,
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });

  return config;
}

module.exports = createRunOncePlugin(withRnfbIosFix, 'with-rnfb-ios-fix', '1.0.0');

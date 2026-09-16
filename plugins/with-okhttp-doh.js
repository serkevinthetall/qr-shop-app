const {
  createRunOncePlugin,
  withDangerousMod,
  withMainApplication,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'DohOkHttpClientFactory';
const SOURCE_DIR = path.join(__dirname, 'okhttp-doh');

function packageToPath(packageName) {
  return packageName.replace(/\./g, '/');
}

function withDohSourceFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const packageName = cfg.android?.package;
      if (!packageName) {
        throw new Error('with-okhttp-doh: missing android.package in app config');
      }

      const targetDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/java',
        packageToPath(packageName),
        'network',
      );

      fs.mkdirSync(targetDir, { recursive: true });

      for (const fileName of ['DohDns.kt', 'DohOkHttpClientFactory.kt']) {
        const sourcePath = path.join(SOURCE_DIR, fileName);
        const targetPath = path.join(targetDir, fileName);
        let contents = fs.readFileSync(sourcePath, 'utf8');
        contents = contents.replace(
          /package com\.qrshop\.myanmar\.network/g,
          `package ${packageName}.network`,
        );
        fs.writeFileSync(targetPath, contents);
      }

      return cfg;
    },
  ]);
}

function ensureImport(src, importLine) {
  if (src.includes(importLine)) {
    return src;
  }

  const packageMatch = src.match(/^package .+$/m);
  if (!packageMatch) {
    return `${importLine}\n${src}`;
  }

  const insertAt = packageMatch.index + packageMatch[0].length;
  return `${src.slice(0, insertAt)}\n\n${importLine}${src.slice(insertAt)}`;
}

function withDohMainApplication(config) {
  return withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;
    const packageName = cfg.android?.package || 'com.qrshop.myanmar';

    src = ensureImport(
      src,
      'import com.facebook.react.modules.network.OkHttpClientProvider',
    );
    src = ensureImport(src, `import ${packageName}.network.DohOkHttpClientFactory`);

    if (!src.includes(MARKER)) {
      if (!src.includes('super.onCreate()')) {
        throw new Error(
          'with-okhttp-doh: could not find super.onCreate() in MainApplication',
        );
      }

      src = src.replace(
        'super.onCreate()',
        `super.onCreate()
    // Cloudflare DoH (1.1.1.1) + certificate pinning for API hosts.
    OkHttpClientProvider.setOkHttpClientFactory(DohOkHttpClientFactory())`,
      );
    }

    cfg.modResults.contents = src;
    return cfg;
  });
}

function withOkHttpDoh(config) {
  config = withDohSourceFiles(config);
  config = withDohMainApplication(config);
  return config;
}

module.exports = createRunOncePlugin(withOkHttpDoh, 'with-okhttp-doh', '1.2.0');

const { withAppBuildGradle } = require('expo/config-plugins');

// Credentials are supplied only by the local build process.
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    const original = mod.modResults.contents;
    if (original.includes('System.getenv("SVOI_KEYSTORE")')) return mod;
    const releaseMarker = 'signingConfig signingConfigs.debug';
    const lastSigning = original.lastIndexOf(releaseMarker);
    if (lastSigning < 0) throw new Error('Cannot find Android release signing configuration');
    mod.modResults.contents = original.slice(0, lastSigning)
      + 'signingConfig signingConfigs.release'
      + original.slice(lastSigning + releaseMarker.length);
    mod.modResults.contents = mod.modResults.contents.replace(
      'signingConfigs {',
      `signingConfigs {
        // svoi-release-signing
        release {
            if (System.getenv("SVOI_KEYSTORE")) {
                storeFile file(System.getenv("SVOI_KEYSTORE"))
                storePassword System.getenv("SVOI_STORE_PASSWORD")
                keyAlias System.getenv("SVOI_KEY_ALIAS")
                keyPassword System.getenv("SVOI_KEY_PASSWORD")
            }
        }`
    );
    return mod;
  });
};

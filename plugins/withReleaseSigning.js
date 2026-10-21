// Firma la build release con la upload keystore invece della debug keystore del template.
// Legge ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS e ANDROID_KEY_PASSWORD
// dall'ambiente; se ANDROID_KEYSTORE_PATH non è impostata la release resta firmata in debug
// (utile per gli APK di prova).
const { withAppBuildGradle } = require("expo/config-plugins");

const RELEASE_SIGNING = `
        release {
            if (System.getenv('ANDROID_KEYSTORE_PATH')) {
                storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            }
        }`;

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes("ANDROID_KEYSTORE_PATH")) return cfg;

    // Aggiunge signingConfigs.release subito dopo quella di debug
    gradle = gradle.replace(
      /(signingConfigs \{\s*debug \{[^}]*\})/,
      `$1${RELEASE_SIGNING}`,
    );

    // La build release usa la nuova config solo se la keystore è fornita
    gradle = gradle.replace(
      /(release \{\s*\/\/ Caution![^\n]*\n[^\n]*\n\s*)signingConfig signingConfigs\.debug/,
      `$1signingConfig System.getenv('ANDROID_KEYSTORE_PATH') ? signingConfigs.release : signingConfigs.debug`,
    );

    if (!gradle.includes("signingConfigs.release")) {
      throw new Error("withReleaseSigning: template build.gradle non riconosciuto");
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });

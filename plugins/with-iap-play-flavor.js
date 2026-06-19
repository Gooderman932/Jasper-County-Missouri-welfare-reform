/**
 * with-iap-play-flavor.js
 *
 * `react-native-iap` publishes two Android product flavors — `play` (Google
 * Play Billing) and `amazon` (Amazon Appstore). When the consumer app does
 * not declare which flavor it wants, Gradle's variant-aware dependency
 * resolution fails with:
 *   > Could not resolve project :react-native-iap.
 *   > However we cannot choose between the following variants ...
 *
 * This config plugin injects `missingDimensionStrategy 'store', 'play'`
 * into android/app/build.gradle so the build picks Play Billing every
 * time. We're shipping to the Play Store only, so `play` is the right
 * default. Switch to 'amazon' if/when we publish to Amazon Appstore.
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = "missingDimensionStrategy 'store', 'play'";

module.exports = function withIapPlayFlavor(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) {
      return cfg;
    }
    // Inject inside the android { defaultConfig { ... } } block. The Expo
    // template ships `defaultConfig {` on its own line, so we anchor on that.
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /defaultConfig\s*\{/,
      (m) => `${m}\n        ${MARKER}`,
    );
    return cfg;
  });
};

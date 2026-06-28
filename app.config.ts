// Dynamic Expo config. Reads values from the environment so production
// secrets (Appwrite endpoint/project ID, etc.) never live in source control.
//
// Locally:
//   Put values in a .env file (gitignored) — expo will pick them up via
//   the EXPO_PUBLIC_ prefix when running `expo start`. For non-EXPO_PUBLIC_
//   names, export them in your shell before running the command.
//
// On EAS Build:
//   Define the same names with `eas env:create` for the `production`
//   environment. EAS injects them into the build worker before this file
//   is evaluated.
//
// Required for a usable production build:
//   APPWRITE_ENDPOINT          e.g. https://cloud.appwrite.io/v1
//   APPWRITE_PROJECT_ID        e.g. 65f1aabbccddeeff0011
//
// Optional overrides:
//   APPWRITE_DATABASE_ID       (default: family_rights_main)
//   APPWRITE_ADMIN_TEAM_ID     (default: admin)
//   PREMIUM_PRODUCT_ID         (default: premium_monthly_599)
//   PREMIUM_BASE_PLAN_ID       (default: monthly-autorenew)
//   PREMIUM_OFFER_ID           (default: freetrial-1m)
//   SENTRY_DSN                 Sentry Data Source Name for crash reporting
//                              Get one at https://sentry.io (free tier available)
//                              Project Settings → Client Keys → DSN

import type { ExpoConfig } from '@expo/config-types';

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT ?? 'https://appwrite.example.com/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? 'REPLACE_ME';
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID ?? 'family_rights_main';
const APPWRITE_ADMIN_TEAM_ID = process.env.APPWRITE_ADMIN_TEAM_ID ?? 'admin';

const PREMIUM_PRODUCT_ID = process.env.PREMIUM_PRODUCT_ID ?? 'premium_monthly_599';
const PREMIUM_BASE_PLAN_ID = process.env.PREMIUM_BASE_PLAN_ID ?? 'monthly-autorenew';
const PREMIUM_OFFER_ID = process.env.PREMIUM_OFFER_ID ?? 'freetrial-1m';

// DSN is a public client credential — safe to commit (sentry.io/docs/security).
// Override with SENTRY_DSN env var if you fork the project under a different org.
const SENTRY_DSN = process.env.SENTRY_DSN ?? 'https://5b6cf054db7121e2ce637a9b07212523@o4511628742033408.ingest.us.sentry.io/4511628770476032';

// Loud warning when a production build is missing Appwrite values. Doesn't
// fail the build — the app still ships and will run in in-memory mode —
// but operators should see this in the EAS log.
// Hard-fail when a production/preview build ships with placeholder Appwrite
// values — a warn-only check is easy to miss in EAS logs and leads to silent
// backend outages. CI/dev builds intentionally skip this guard.
const isEasBuild = ['production', 'preview'].includes(process.env.EAS_BUILD_PROFILE ?? '');
if (isEasBuild) {
  const missing: string[] = [];
  if (!APPWRITE_PROJECT_ID || APPWRITE_PROJECT_ID === 'REPLACE_ME') missing.push('APPWRITE_PROJECT_ID');
  if (!APPWRITE_ENDPOINT || APPWRITE_ENDPOINT.includes('example.com')) missing.push('APPWRITE_ENDPOINT');
  if (missing.length > 0) {
    throw new Error(
      `[app.config] Production/preview build is missing required env vars: ${missing.join(', ')}. ` +
        'Set them via `eas env:create` before building.',
    );
  }
}

const config: ExpoConfig = {
  name: 'Family Rights',
  slug: 'family-rights-app',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'familyrights',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0E1A2B',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.poordudeholdings.familyrights',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0E1A2B',
    },
    package: 'com.poordudeholdings.familyrights',
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'RECORD_AUDIO',
      'com.android.vending.BILLING',
    ],
  },
  web: {
    bundler: 'metro',
  },
  // Pin a runtimeVersion so OTA updates only ship to compatible native builds.
  // Tied to the native binary — must change whenever native deps change.
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    // EAS Update endpoint for this project. Required by expo-updates so the
    // Android manifest merger has a value for the EXPO_UPDATE_URL placeholder.
    url: 'https://u.expo.dev/da23cbf7-9e65-48a5-9b6b-2e9fd0dcf9a8',
    enabled: true,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
  },
  plugins: [
    'expo-secure-store',
    'expo-camera',
    'expo-image-picker',
    'expo-document-picker',
    'expo-notifications',
    'expo-updates',
    './plugins/with-iap-play-flavor.js',
    '@sentry/react-native/expo',
  ],
  extra: {
    appwriteEndpoint: APPWRITE_ENDPOINT,
    appwriteProjectId: APPWRITE_PROJECT_ID,
    appwriteDatabaseId: APPWRITE_DATABASE_ID,
    appwriteAdminTeamId: APPWRITE_ADMIN_TEAM_ID,
    premiumProductId: PREMIUM_PRODUCT_ID,
    premiumBasePlanId: PREMIUM_BASE_PLAN_ID,
    premiumOfferId: PREMIUM_OFFER_ID,
    sentryDsn: SENTRY_DSN,
    // EAS project linking. Hardcoded because EAS CLI cannot auto-edit
    // dynamic config files; run `eas init` once to (re)issue this ID.
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? 'da23cbf7-9e65-48a5-9b6b-2e9fd0dcf9a8',
    },
  },
  owner: 'poor-dude-holdings-llc',
};

export default config;

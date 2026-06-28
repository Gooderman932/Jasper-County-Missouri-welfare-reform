/**
 * Sentry crash-reporting initializer.
 *
 * Call initSentry() once at app startup (before the first render).
 * It reads SENTRY_DSN from expo-constants so the value comes from .env
 * (local dev) or EAS env vars (production) — never hardcoded.
 *
 * If SENTRY_DSN is absent or the native module isn't linked yet
 * (e.g. bare dev without expo prebuild) the call is a safe no-op and
 * the console fallback in crashReporter.ts remains active.
 *
 * How to get a Sentry DSN:
 *   1. Sign up free at https://sentry.io
 *   2. Create a new project → choose "React Native"
 *   3. Copy the DSN from Project Settings → Client Keys
 *   4. Add SENTRY_DSN=<value> to .env and to EAS via `eas env:create`
 */

import Constants from 'expo-constants';
import { configureCrashReporter, CrashReporter } from './crashReporter';

export function initSentry(): void {
  const dsn: string | undefined = (Constants.expoConfig?.extra as Record<string, unknown>)?.sentryDsn as string;
  if (!dsn) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
    Sentry.init({
      dsn,
      // PII redaction: don't attach user identity beyond the anonymised userId
      sendDefaultPii: false,
      // Distinguish prod crashes from noisy dev crashes
      environment: __DEV__ ? 'development' : 'production',
      // Breadcrumb sampling — keep 100 most-recent events leading to a crash
      maxBreadcrumbs: 100,
    });

    const reporter: CrashReporter = {
      captureException(error, context) {
        Sentry.captureException(error, context ? { extra: context as Record<string, unknown> } : undefined);
      },
      captureMessage(message, context) {
        Sentry.captureMessage(message, { extra: context as Record<string, unknown> });
      },
    };

    configureCrashReporter(reporter);
  } catch {
    // Native module not available (dev without prebuild). Console fallback stays.
  }
}

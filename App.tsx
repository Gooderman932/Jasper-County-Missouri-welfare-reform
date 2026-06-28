import 'react-native-get-random-values';
import { initSentry } from './src/lib/sentry';
// Initialize Sentry before anything else so the first frame is covered.
initSentry();
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { RootNavigator } from '@app/navigation/RootNavigator';
import { useContainer, Container } from '@app/hooks/useContainer';
import { AppContextProvider, useApp } from '@app/hooks/useApp';
import { ErrorBoundary } from '@app/components/ErrorBoundary';
import { theme } from '@app/theme';
import { seedSD38180IfFirstRun } from '@infra/seed/sd38180';

const USE_MEMORY = process.env.EXPO_PUBLIC_USE_MEMORY_REPOS === 'true';

// Lives inside AppContextProvider so it can feed user activity into the
// inactivity timer that powers automatic logoff. We capture activity from any
// touch (not just navigation) so a user working on a single screen for a long
// time isn't logged out mid-task. onStartShouldSetResponderCapture returns
// false so the gesture still reaches child components — we only observe it.
const linking = {
  prefixes: ['familyrights://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
    },
  },
};

function NavigationRoot() {
  const { recordActivity } = useApp();
  const onTouchCapture = (_e: GestureResponderEvent) => {
    recordActivity();
    return false;
  };
  return (
    <View style={{ flex: 1 }} onStartShouldSetResponderCapture={onTouchCapture}>
      <NavigationContainer linking={linking} onStateChange={recordActivity}>
        <StatusBar style="dark" />
        <RootNavigator />
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  const container = useContainer();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Awaited<ReturnType<Container['auth']['getCurrentUser']>>>(null);

  useEffect(() => {
    (async () => {
      const u = await container.auth.getCurrentUser();
      setUser(u);
      // In LOCAL-DEV memory mode, auto-seed SD38180 on first boot so the
      // app lands directly on the case data without needing a backend.
      if (USE_MEMORY && u) {
        try {
          await seedSD38180IfFirstRun({
            auth: container.auth,
            cases: container.cases,
            parties: container.parties,
            events: container.events,
            documents: container.documents,
            issues: container.issues,
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[App] auto-seed failed (continuing anyway):', err);
        }
      }
      setReady(true);
    })();
  }, [container]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AppContextProvider container={container} initialUser={user}>
            <NavigationRoot />
          </AppContextProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

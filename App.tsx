import 'react-native-get-random-values';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, View } from 'react-native';
import { RootNavigator } from '@app/navigation/RootNavigator';
import { useContainer, Container } from '@app/hooks/useContainer';
import { AppContextProvider } from '@app/hooks/useApp';
import { theme } from '@app/theme';

export default function App() {
  const container = useContainer();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Awaited<ReturnType<Container['auth']['getCurrentUser']>>>(null);

  useEffect(() => {
    (async () => {
      const u = await container.auth.getCurrentUser();
      setUser(u);
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppContextProvider container={container} initialUser={user}>
          <NavigationContainer>
            <StatusBar style="dark" />
            <RootNavigator />
          </NavigationContainer>
        </AppContextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

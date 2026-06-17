import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useApp } from '@app/hooks/useApp';

import { WelcomeScreen } from '@app/screens/onboarding/WelcomeScreen';
import { MissionScreen } from '@app/screens/onboarding/MissionScreen';
import { PrivacyConsentScreen } from '@app/screens/onboarding/PrivacyConsentScreen';
import { SubscriptionPreviewScreen } from '@app/screens/onboarding/SubscriptionPreviewScreen';
import { SignUpScreen } from '@app/screens/onboarding/SignUpScreen';
import { SignInScreen } from '@app/screens/onboarding/SignInScreen';
import { CreateFirstCaseScreen } from '@app/screens/onboarding/CreateFirstCaseScreen';

import { HomeScreen } from '@app/screens/HomeScreen';
import { CasesScreen } from '@app/screens/CasesScreen';
import { CaseDetailScreen } from '@app/screens/CaseDetailScreen';
import { CaptureScreen } from '@app/screens/CaptureScreen';
import { RightsReviewScreen } from '@app/screens/RightsReviewScreen';
import { PatternScreen } from '@app/screens/PatternScreen';
import { ExportScreen } from '@app/screens/ExportScreen';
import { PaywallScreen } from '@app/screens/PaywallScreen';
import { SettingsScreen } from '@app/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: true }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Cases" component={CasesScreen} />
      <Tab.Screen name="Capture" component={CaptureScreen} />
      <Tab.Screen name="Review" component={RightsReviewScreen} />
      <Tab.Screen name="Export" component={ExportScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { user } = useApp();
  return (
    <Stack.Navigator>
      {!user ? (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Mission" component={MissionScreen} options={{ title: 'What this app does' }} />
          <Stack.Screen name="PrivacyConsent" component={PrivacyConsentScreen} options={{ title: 'Privacy & Consent' }} />
          <Stack.Screen name="SubscriptionPreview" component={SubscriptionPreviewScreen} options={{ title: 'Subscription' }} />
          <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Create account' }} />
          <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Sign in' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="CaseDetail" component={CaseDetailScreen} options={{ title: 'Case' }} />
          <Stack.Screen name="Pattern" component={PatternScreen} options={{ title: 'Patterns' }} />
          <Stack.Screen name="Paywall" component={PaywallScreen} options={{ title: 'Premium' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          <Stack.Screen name="CreateFirstCase" component={CreateFirstCaseScreen} options={{ title: 'New case' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

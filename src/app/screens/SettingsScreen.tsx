import React from 'react';
import { ScrollView, Alert } from 'react-native';
import { Body, Button, Card, H1, H2, Screen } from '@app/components/Common';
import { useApp } from '@app/hooks/useApp';
import { PRIMARY_DISCLAIMER, COALITION_DISCLAIMER, SAFETY_NOTE, SUBSCRIPTION_DISCLOSURE } from '@shared/constants/disclaimers';

export function SettingsScreen() {
  const { container, user, setUser, entitlement } = useApp();

  const signOut = async () => {
    await container.auth.signOut();
    setUser(null);
  };

  return (
    <Screen>
      <ScrollView>
        <H1>Settings</H1>
        <Card>
          <H2>Account</H2>
          <Body>{user?.email}</Body>
          <Body muted>Entitlement: {entitlement?.status ?? 'free'}</Body>
          <Button label="Sign out" variant="danger" onPress={() => Alert.alert('Sign out?', '', [{ text: 'Cancel' }, { text: 'Sign out', onPress: signOut }])} />
        </Card>
        <Card>
          <H2>Disclaimer</H2>
          <Body>{PRIMARY_DISCLAIMER}</Body>
        </Card>
        <Card>
          <H2>Coalition disclaimer</H2>
          <Body>{COALITION_DISCLAIMER}</Body>
        </Card>
        <Card>
          <H2>Safety</H2>
          <Body>{SAFETY_NOTE}</Body>
        </Card>
        <Card>
          <H2>Subscription</H2>
          <Body>{SUBSCRIPTION_DISCLOSURE}</Body>
        </Card>
      </ScrollView>
    </Screen>
  );
}

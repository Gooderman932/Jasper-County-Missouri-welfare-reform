import React, { useState } from 'react';
import { ScrollView, Alert, TextInput, StyleSheet, Linking } from 'react-native';
import { Body, Button, Card, H1, H2, Screen } from '@app/components/Common';
import { useApp } from '@app/hooks/useApp';
import { PRIMARY_DISCLAIMER, COALITION_DISCLAIMER, SAFETY_NOTE, SUBSCRIPTION_DISCLOSURE, PRIVACY_POLICY_URL } from '@shared/constants/disclaimers';
import { theme } from '@app/theme';

export function SettingsScreen() {
  const { container, user, setUser, entitlement } = useApp();
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    await container.auth.signOut();
    setUser(null);
  };

  const startDeleteFlow = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated case data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: () => setDeleteConfirming(true) },
      ],
    );
  };

  const confirmDelete = async () => {
    if (!deletePassword.trim()) {
      Alert.alert('Enter your password to confirm deletion.');
      return;
    }
    setBusy(true);
    try {
      await container.auth.deleteAccount(deletePassword);
      setUser(null);
    } catch (err: any) {
      Alert.alert('Delete failed', err?.message ?? 'Check your password and try again.');
      setBusy(false);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirming(false);
    setDeletePassword('');
  };

  return (
    <Screen>
      <ScrollView>
        <H1>Settings</H1>
        <Card>
          <H2>Account</H2>
          <Body>{user?.email}</Body>
          <Body muted>Entitlement: {entitlement?.status ?? 'free'}</Body>
          <Button
            label="Sign out"
            variant="danger"
            onPress={() =>
              Alert.alert('Sign out?', '', [{ text: 'Cancel' }, { text: 'Sign out', onPress: signOut }])
            }
          />
        </Card>

        {!deleteConfirming ? (
          <Card>
            <H2>Delete Account</H2>
            <Body muted>
              Permanently removes your account, all cases, documents, and evidence. Cannot be undone.
            </Body>
            <Button label="Delete Account" variant="danger" onPress={startDeleteFlow} />
          </Card>
        ) : (
          <Card>
            <H2>Confirm Deletion</H2>
            <Body muted>Enter your password to permanently delete your account and all data.</Body>
            <TextInput
              style={styles.passwordInput}
              placeholder="Your password"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
              autoFocus
            />
            <Button
              label={busy ? 'Deleting…' : 'Permanently Delete My Account'}
              variant="danger"
              onPress={confirmDelete}
              disabled={busy}
            />
            <Button label="Cancel" onPress={cancelDelete} disabled={busy} />
          </Card>
        )}

        <Card>
          <H2>Privacy</H2>
          <Body muted>Review our privacy policy to understand how your data is stored and protected.</Body>
          <Button label="View Privacy Policy" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} />
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

const styles = StyleSheet.create({
  passwordInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
});

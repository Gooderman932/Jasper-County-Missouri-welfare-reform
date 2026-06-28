import React, { useState } from 'react';
import { Alert, TextInput, StyleSheet } from 'react-native';
import { Body, Button, Card, H2, Screen } from '@app/components/Common';
import { theme } from '@app/theme';
import { account } from '@infra/appwrite/client';

export function ResetPasswordScreen({ route, navigation }: any) {
  const { userId, secret } = route.params ?? {};
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  if (!userId || !secret) {
    return (
      <Screen>
        <Card>
          <H2>Invalid Link</H2>
          <Body muted>The reset link is missing required parameters. Please request a new one.</Body>
        </Card>
        <Button label="Back to sign in" variant="ghost" onPress={() => navigation.navigate('SignIn')} />
      </Screen>
    );
  }

  const onSubmit = async () => {
    if (password.length < 8) {
      Alert.alert('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      // @ts-expect-error — SDK types declare 3 args but Appwrite REST API requires confirm as 4th
      await account.updateRecovery(userId, secret, password, confirm);
      Alert.alert('Password updated', 'You can now sign in with your new password.', [
        { text: 'Sign in', onPress: () => navigation.navigate('SignIn') },
      ]);
    } catch (err: any) {
      Alert.alert('Reset failed', err?.message ?? 'The link may have expired. Request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Card>
        <H2>Choose a new password</H2>
        <Body muted>Must be at least 8 characters.</Body>
        <TextInput
          placeholder="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          autoFocus
          style={styles.input}
          placeholderTextColor={theme.colors.textMuted}
        />
        <TextInput
          placeholder="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          style={styles.input}
          placeholderTextColor={theme.colors.textMuted}
        />
      </Card>
      <Button label={loading ? 'Saving…' : 'Set new password'} onPress={onSubmit} disabled={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: '#fff',
    marginTop: 8,
    color: theme.colors.text,
  },
});

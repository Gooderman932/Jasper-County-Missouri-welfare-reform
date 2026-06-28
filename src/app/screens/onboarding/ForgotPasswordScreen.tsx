import React, { useState } from 'react';
import { Alert, TextInput, StyleSheet } from 'react-native';
import { Body, Button, Card, H2, Screen } from '@app/components/Common';
import { theme } from '@app/theme';
import { account } from '@infra/appwrite/client';
import { ACCOUNT_RESET_URL } from '@shared/constants/disclaimers';

export function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await account.createRecovery(trimmed, ACCOUNT_RESET_URL);
      setSent(true);
    } catch (err: any) {
      Alert.alert('Could not send reset email', err?.message ?? 'Check the address and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Screen>
        <Card>
          <H2>Check your email</H2>
          <Body>
            A password reset link was sent to {email.trim().toLowerCase()}. Open the link on this
            device to choose a new password.
          </Body>
          <Body muted>The link expires in 1 hour.</Body>
        </Card>
        <Button label="Back to sign in" variant="ghost" onPress={() => navigation.navigate('SignIn')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <H2>Reset your password</H2>
        <Body muted>Enter the email you used to create your account. We'll send a reset link.</Body>
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoFocus
          style={styles.input}
          placeholderTextColor={theme.colors.textMuted}
        />
      </Card>
      <Button label={loading ? 'Sending…' : 'Send reset link'} onPress={onSubmit} disabled={loading} />
      <Button label="Back to sign in" variant="ghost" onPress={() => navigation.goBack()} disabled={loading} />
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

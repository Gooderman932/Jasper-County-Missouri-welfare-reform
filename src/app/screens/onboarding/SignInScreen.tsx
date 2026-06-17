import React, { useState } from 'react';
import { Alert, TextInput, StyleSheet } from 'react-native';
import { Body, Button, Card, H2, Screen } from '@app/components/Common';
import { useApp } from '@app/hooks/useApp';
import { theme } from '@app/theme';
import { seedSD38180IfFirstRun } from '@infra/seed/sd38180';

export function SignInScreen({ navigation }: any) {
  const { container, setUser } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    try {
      const u = await container.auth.signIn(email.trim().toLowerCase(), password);
      setUser(u);
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
        console.warn('[seed] failed', err);
      }
    } catch (err: any) {
      Alert.alert('Sign in failed', err?.message ?? 'Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Card>
        <H2>Welcome back</H2>
        <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
        <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
      </Card>
      <Button label={loading ? 'Signing in…' : 'Sign in'} onPress={onSubmit} disabled={loading} />
      <Button label="Create an account" variant="ghost" onPress={() => navigation.navigate('SignUp')} />
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
  },
});

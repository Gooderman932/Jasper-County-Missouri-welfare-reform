import React, { useState } from 'react';
import { Alert, TextInput, StyleSheet } from 'react-native';
import { Body, Button, Card, H2, Screen } from '@app/components/Common';
import { useApp } from '@app/hooks/useApp';
import { theme } from '@app/theme';
import { seedSD38180IfFirstRun } from '@infra/seed/sd38180';
import { secureStorage, STORAGE_KEYS } from '@infra/storage/secureStore';

export function SignUpScreen({ navigation }: any) {
  const { container, setUser } = useApp();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    try {
      const u = await container.auth.signUp(email.trim().toLowerCase(), password, name.trim() || undefined);
      setUser(u);
      // Run seed for first-time users
      try {
        const ran = await seedSD38180IfFirstRun({
          auth: container.auth,
          cases: container.cases,
          parties: container.parties,
          events: container.events,
          documents: container.documents,
          issues: container.issues,
        });
        if (ran) await secureStorage.set(STORAGE_KEYS.seedRan, new Date().toISOString());
      } catch (err) {
        console.warn('[seed] failed', err);
      }
    } catch (err: any) {
      Alert.alert('Sign up failed', err?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Card>
        <H2>Create your account</H2>
        <Body muted>Your data is stored under owner-only permissions.</Body>
        <TextInput placeholder="Name (optional)" value={name} onChangeText={setName} style={styles.input} />
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
      </Card>
      <Button label={loading ? 'Creating…' : 'Create account'} onPress={onSubmit} disabled={loading} />
      <Button label="I already have an account" variant="ghost" onPress={() => navigation.navigate('SignIn')} />
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

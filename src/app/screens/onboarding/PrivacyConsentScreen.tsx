import React, { useState } from 'react';
import { ScrollView, Pressable, View, StyleSheet, Text } from 'react-native';
import { Body, Button, Card, H2, Screen } from '@app/components/Common';
import { COALITION_DISCLAIMER, PRIMARY_DISCLAIMER } from '@shared/constants/disclaimers';
import { secureStorage, STORAGE_KEYS } from '@infra/storage/secureStore';
import { theme } from '@app/theme';

function Checkbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <Pressable onPress={onToggle} style={styles.row}>
      <View style={[styles.box, checked && { backgroundColor: theme.colors.primary }]} />
      <Text style={{ flex: 1, color: theme.colors.text, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function PrivacyConsentScreen({ navigation }: any) {
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [c3, setC3] = useState(false);
  const allChecked = c1 && c2 && c3;

  return (
    <Screen>
      <ScrollView>
        <Card>
          <H2>Privacy & Consent</H2>
          <Body muted>Your case data is stored under owner-only permissions by default. Coalition and attorney-review features require separate, explicit consent later.</Body>
        </Card>
        <Card>
          <Checkbox checked={c1} onToggle={() => setC1(!c1)} label={PRIMARY_DISCLAIMER} />
          <Checkbox checked={c2} onToggle={() => setC2(!c2)} label={COALITION_DISCLAIMER} />
          <Checkbox checked={c3} onToggle={() => setC3(!c3)} label="I understand this app helps me organize and document my case, but does not provide legal representation or guarantee any outcome." />
        </Card>
      </ScrollView>
      <Button
        label="I agree — continue"
        disabled={!allChecked}
        onPress={async () => {
          await secureStorage.set(STORAGE_KEYS.consentAccepted, new Date().toISOString());
          navigation.navigate('SubscriptionPreview');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 6 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    marginRight: 10,
    marginTop: 2,
  },
});

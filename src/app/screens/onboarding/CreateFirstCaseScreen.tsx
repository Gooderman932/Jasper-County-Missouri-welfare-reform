import React, { useState } from 'react';
import { Alert, TextInput, StyleSheet, View, Text } from 'react-native';
import { Body, Button, Card, H2, Screen } from '@app/components/Common';
import { theme } from '@app/theme';
import { useApp } from '@app/hooks/useApp';
import { CaseType } from '@domain/entities';

const TYPES: { id: CaseType; label: string }[] = [
  { id: 'investigation', label: 'Investigation' },
  { id: 'abuse_neglect', label: 'Abuse / Neglect' },
  { id: 'foster_care', label: 'Foster care' },
  { id: 'reunification', label: 'Reunification' },
  { id: 'tpr', label: 'Termination of parental rights' },
  { id: 'appeal', label: 'Appeal' },
  { id: 'other', label: 'Other' },
];

export function CreateFirstCaseScreen({ navigation }: any) {
  const { container } = useApp();
  const [title, setTitle] = useState('');
  const [state, setState] = useState('MO');
  const [county, setCounty] = useState('');
  const [caseType, setCaseType] = useState<CaseType>('investigation');

  const onCreate = async () => {
    if (!title.trim()) return Alert.alert('Title required');
    try {
      const c = await container.usecases.createCaseForCurrentUser({
        title: title.trim(),
        jurisdictionState: state,
        jurisdictionCounty: county || undefined,
        caseType,
      });
      navigation.replace('CaseDetail', { caseId: c.id });
    } catch (err: any) {
      Alert.alert('Could not create case', err?.message ?? 'Try again.');
    }
  };

  return (
    <Screen>
      <Card>
        <H2>New case</H2>
        <Body muted>A short title helps you find this case later.</Body>
        <TextInput placeholder="Case title" value={title} onChangeText={setTitle} style={styles.input} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TextInput placeholder="State" value={state} onChangeText={setState} style={[styles.input, { flex: 1 }]} />
          <TextInput placeholder="County" value={county} onChangeText={setCounty} style={[styles.input, { flex: 2 }]} />
        </View>
        <Text style={{ marginTop: 12, fontWeight: '600' }}>Case type</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {TYPES.map((t) => (
            <Text
              key={t.id}
              onPress={() => setCaseType(t.id)}
              style={[
                styles.pill,
                caseType === t.id && { backgroundColor: theme.colors.primary, color: '#fff' },
              ]}
            >
              {t.label}
            </Text>
          ))}
        </View>
      </Card>
      <Button label="Create case" onPress={onCreate} />
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
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: 13,
    color: theme.colors.text,
  },
});

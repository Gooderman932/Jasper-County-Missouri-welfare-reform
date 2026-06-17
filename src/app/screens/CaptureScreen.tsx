import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, TextInput, StyleSheet, View, Text } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Body, Button, Card, H1, H2, Screen } from '@app/components/Common';
import { useApp } from '@app/hooks/useApp';
import { theme } from '@app/theme';
import { CaseRecord, DocumentCategory, EventType } from '@domain/entities';

const CATEGORIES: DocumentCategory[] = [
  'court_order',
  'petition',
  'service_plan',
  'drug_test',
  'medical',
  'school',
  'photo',
  'screenshot',
  'audio_note',
  'correspondence',
  'other',
];

const EVENT_TYPES: EventType[] = [
  'report',
  'home_visit',
  'removal',
  'shelter_hearing',
  'adjudication',
  'review_hearing',
  'permanency_hearing',
  'service_plan',
  'drug_test',
  'visit',
  'tpr_petition',
  'tpr_trial',
  'tpr_judgment',
  'appeal',
  'meeting',
  'other',
];

export function CaptureScreen() {
  const { container, user } = useApp();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCase, setActiveCase] = useState<string | null>(null);

  // Document state
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<DocumentCategory>('other');

  // Event state
  const [eventType, setEventType] = useState<EventType>('meeting');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventDesc, setEventDesc] = useState('');

  useEffect(() => {
    (async () => {
      if (!user) return;
      const list = await container.cases.listCases(user.id);
      setCases(list);
      if (list.length > 0 && !activeCase) setActiveCase(list[0].id);
    })();
  }, [container, user, activeCase]);

  const pickAndUpload = async () => {
    if (!activeCase) return Alert.alert('Select a case first');
    if (!docTitle.trim()) return Alert.alert('Document title required');
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled) return;
    const file = res.assets[0];
    try {
      await container.usecases.uploadDocumentWithOcr({
        caseId: activeCase,
        title: docTitle,
        category: docCategory,
        fileUri: file.uri,
        mimeType: file.mimeType ?? 'application/octet-stream',
      });
      setDocTitle('');
      Alert.alert('Uploaded', 'Document uploaded. OCR runs in background.');
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Try again.');
    }
  };

  const takePhotoAndUpload = async () => {
    if (!activeCase) return Alert.alert('Select a case first');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Camera permission required');
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (res.canceled) return;
    const file = res.assets[0];
    try {
      await container.usecases.uploadDocumentWithOcr({
        caseId: activeCase,
        title: docTitle || `Photo ${new Date().toLocaleString()}`,
        category: 'photo',
        fileUri: file.uri,
        mimeType: 'image/jpeg',
      });
      Alert.alert('Photo saved');
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Try again.');
    }
  };

  const addEvent = async () => {
    if (!activeCase) return Alert.alert('Select a case first');
    if (!eventDesc.trim()) return Alert.alert('Event description required');
    try {
      await container.events.addEvent({
        caseId: activeCase,
        eventType,
        occurredAt: new Date(eventDate).toISOString(),
        description: eventDesc.trim(),
      });
      setEventDesc('');
      Alert.alert('Event logged');
    } catch (err: any) {
      Alert.alert('Could not save', err?.message ?? 'Try again.');
    }
  };

  return (
    <Screen>
      <ScrollView>
        <H1>Capture</H1>
        <Card>
          <H2>Active case</H2>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {cases.map((c) => (
              <Text
                key={c.id}
                onPress={() => setActiveCase(c.id)}
                style={[styles.pill, activeCase === c.id && { backgroundColor: theme.colors.primary, color: '#fff' }]}
              >
                {c.title.length > 30 ? c.title.slice(0, 27) + '…' : c.title}
              </Text>
            ))}
          </View>
        </Card>

        <Card>
          <H2>Upload document</H2>
          <TextInput placeholder="Document title" value={docTitle} onChangeText={setDocTitle} style={styles.input} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {CATEGORIES.map((c) => (
              <Text
                key={c}
                onPress={() => setDocCategory(c)}
                style={[styles.pill, docCategory === c && { backgroundColor: theme.colors.primary, color: '#fff' }]}
              >
                {c}
              </Text>
            ))}
          </View>
          <Button label="Pick file" onPress={pickAndUpload} />
          <Button label="Take photo" variant="secondary" onPress={takePhotoAndUpload} />
        </Card>

        <Card>
          <H2>Log event</H2>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {EVENT_TYPES.map((t) => (
              <Text
                key={t}
                onPress={() => setEventType(t)}
                style={[styles.pill, eventType === t && { backgroundColor: theme.colors.primary, color: '#fff' }]}
              >
                {t}
              </Text>
            ))}
          </View>
          <TextInput placeholder="YYYY-MM-DD" value={eventDate} onChangeText={setEventDate} style={styles.input} />
          <TextInput
            placeholder="Description"
            value={eventDesc}
            onChangeText={setEventDesc}
            multiline
            numberOfLines={4}
            style={[styles.input, { minHeight: 80 }]}
          />
          <Button label="Add to timeline" onPress={addEvent} />
        </Card>
      </ScrollView>
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
    fontSize: 12,
    color: theme.colors.text,
  },
});

import React, { useState } from 'react';
import { Alert, View, Pressable } from 'react-native';
import { Body, Button, Card, H1, Screen } from '@app/components/Common';
import { useApp } from '@app/hooks/useApp';
import { ContentReportReason } from '@domain/entities';

/**
 * UGC content-report screen.
 *
 * Play Store and most app stores require a user-facing "report content"
 * mechanism on any product that hosts user-generated content visible to
 * other users. This screen submits a ContentReport row that moderators
 * triage in the admin portal.
 */
const REASONS: Array<{ key: ContentReportReason; label: string }> = [
  { key: 'pii_exposure', label: 'Exposes personal information' },
  { key: 'minor_identification', label: 'Identifies a minor child' },
  { key: 'defamation', label: 'Contains false or defamatory statements' },
  { key: 'harassment', label: 'Targets harassment or stalking' },
  { key: 'inaccurate', label: 'Factually inaccurate' },
  { key: 'copyright', label: 'Copyright or IP violation' },
  { key: 'illegal_content', label: 'Illegal content' },
  { key: 'other', label: 'Other concern' },
];

export function ReportContentScreen({ route, navigation }: any) {
  const { caseId } = route.params;
  const { container, user } = useApp();
  const [selected, setSelected] = useState<ContentReportReason | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await container.reports.createReport({
        caseId,
        reporterUserId: user?.id,
        reason: selected,
      });
      Alert.alert(
        'Report submitted',
        'Thank you. A moderator will review this report. You will not receive a personal reply, but action will be taken if the content violates the policy.',
      );
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Report failed', err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <H1>Report this case</H1>
      <Body muted>
        Tell us why this public case should be reviewed. Reports are anonymous to the case
        publisher and reviewed by app moderators.
      </Body>
      <Card>
        {REASONS.map((r) => (
          <Pressable
            key={r.key}
            onPress={() => setSelected(r.key)}
            style={{
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#e5e7eb',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: '#6b7280',
                  marginRight: 12,
                  backgroundColor: selected === r.key ? '#2563eb' : 'transparent',
                }}
              />
              <Body style={{ flex: 1 }}>{r.label}</Body>
            </View>
          </Pressable>
        ))}
      </Card>
      <Button
        label={submitting ? 'Submitting…' : 'Submit report'}
        onPress={onSubmit}
        disabled={!selected || submitting}
      />
      <Button
        label="Cancel"
        variant="secondary"
        onPress={() => navigation.goBack()}
        disabled={submitting}
      />
    </Screen>
  );
}

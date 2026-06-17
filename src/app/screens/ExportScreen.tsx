import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, View, Text, StyleSheet } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Body, Button, Card, H1, H2, Screen } from '@app/components/Common';
import { useApp, isPremium } from '@app/hooks/useApp';
import { CaseRecord } from '@domain/entities';
import { theme } from '@app/theme';
import { EXPORT_FOOTER } from '@shared/constants/disclaimers';

export function ExportScreen({ route, navigation }: any) {
  const { container, user, entitlement } = useApp();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCase, setActiveCase] = useState<string | null>(route?.params?.caseId ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const list = await container.cases.listCases(user.id);
      setCases(list);
      if (!activeCase && list.length > 0 && list[0]) setActiveCase(list[0].id);
    })();
  }, [container, user, activeCase]);

  const premium = isPremium(entitlement);

  const run = async (kind: 'timeline' | 'issues' | 'attorney') => {
    if (!activeCase) return;
    if (!premium) {
      Alert.alert('Premium required', 'Exports are a Premium feature.', [
        { text: 'See Premium', onPress: () => navigation.navigate('Paywall') },
        { text: 'Cancel' },
      ]);
      return;
    }
    setBusy(true);
    try {
      let result;
      if (kind === 'timeline') result = await container.exports.exportTimelinePdf(activeCase);
      else if (kind === 'issues') result = await container.exports.exportIssueSummaryPdf(activeCase);
      else result = await container.exports.exportAttorneyPacket(activeCase);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri);
      } else {
        Alert.alert('Saved', `Export saved at ${result.uri}`);
      }
    } catch (err: any) {
      Alert.alert('Export failed', err?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView>
        <H1>Exports</H1>
        <Card>
          <H2>Case</H2>
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
          <H2>Timeline PDF</H2>
          <Body muted>Dated event list with linked documents.</Body>
          <Button label={busy ? 'Generating…' : 'Generate timeline PDF'} onPress={() => run('timeline')} disabled={busy} />
        </Card>
        <Card>
          <H2>Issue summary PDF</H2>
          <Body muted>All "possible issue to review" items, grouped by topic.</Body>
          <Button label={busy ? 'Generating…' : 'Generate issue summary PDF'} onPress={() => run('issues')} disabled={busy} />
        </Card>
        <Card>
          <H2>Attorney review packet</H2>
          <Body muted>Full chronological narrative, issue clusters, and supporting documents.</Body>
          <Button label={busy ? 'Generating…' : 'Generate attorney packet'} onPress={() => run('attorney')} disabled={busy} />
        </Card>
        <Card>
          <Body muted>{EXPORT_FOOTER}</Body>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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

import React, { useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { Body, Button, Card, H1, H2, Screen } from '@app/components/Common';
import { useApp } from '@app/hooks/useApp';
import { CaseRecord } from '@domain/entities';

/**
 * Owner-only flow that makes a public case private again. Requires
 * explicit confirmation because cached search results elsewhere may
 * persist for a short window after unpublishing.
 */
export function UnpublishCaseScreen({ route, navigation }: any) {
  const { caseId } = route.params;
  const { container, user } = useApp();
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setRecord(await container.cases.getCaseById(caseId));
  }, [container, caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const onConfirm = async () => {
    if (!record || !user) return;
    setWorking(true);
    try {
      await container.cases.unpublishCase(record.id, user.id);
      Alert.alert('Case unpublished', 'Your case is private again.');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Unpublish failed', err?.message ?? String(err));
    } finally {
      setWorking(false);
    }
  };

  if (!record) {
    return (
      <Screen>
        <Body>Loading…</Body>
      </Screen>
    );
  }

  if (record.visibility !== 'public') {
    return (
      <Screen>
        <H1>Not public</H1>
        <Body>This case is already private.</Body>
        <Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <H1>Make this case private</H1>
      <Card>
        <H2>{record.publicTitle ?? record.title}</H2>
        <Body muted>
          Currently public at /{record.publicSlug}. Unpublishing removes it from the public
          reference library immediately.
        </Body>
      </Card>
      <Body>
        Note: cached search results elsewhere may keep a copy briefly. The app cannot guarantee
        third-party caches are cleared on unpublish.
      </Body>
      <Button
        label={working ? 'Unpublishing…' : 'Make private now'}
        variant="danger"
        onPress={onConfirm}
        disabled={working}
      />
      <Button
        label="Cancel"
        variant="secondary"
        onPress={() => navigation.goBack()}
        disabled={working}
      />
    </Screen>
  );
}

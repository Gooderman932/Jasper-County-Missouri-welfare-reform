import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { Body, Button, Card, H1, H2, Screen } from '@app/components/Common';
import { useApp } from '@app/hooks/useApp';
import { CaseRecord } from '@domain/entities';

export function CasesScreen({ navigation }: any) {
  const { container, user } = useApp();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      setCases(await container.cases.listCases(user.id));
    } finally {
      setRefreshing(false);
    }
  }, [container, user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <H1>Cases</H1>
      <Button label="New case" onPress={() => navigation.navigate('CreateFirstCase')} />
      <FlatList
        data={cases}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => (
          <Card>
            <H2>{item.title}</H2>
            <Body muted>
              {item.caseType} · {item.jurisdictionState}
              {item.jurisdictionCounty ? ` · ${item.jurisdictionCounty}` : ''} · {item.status}
            </Body>
            <Button label="Open" onPress={() => navigation.navigate('CaseDetail', { caseId: item.id })} />
          </Card>
        )}
        ListEmptyComponent={
          <Card>
            <Body>No cases yet.</Body>
          </Card>
        }
      />
    </Screen>
  );
}

import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { Body, Button, Card, H1, H2, Screen } from '@app/components/Common';
import { useApp } from '@app/hooks/useApp';
import { CaseRecord } from '@domain/entities';

/**
 * Browse all PUBLIC cases other users have published as reference material.
 *
 * Read-only. Anyone (signed in or not) can list public cases. The data has
 * already been redacted by the publisher under the case's RedactionPolicy
 * before it was made public.
 */
export function PublicCasesScreen({ navigation }: any) {
  const { container } = useApp();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await container.cases.listPublicCases({ limit: 50 });
      setCases(list);
    } finally {
      setRefreshing(false);
    }
  }, [container]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <H1>Reference Cases</H1>
      <Body muted>
        Real, redacted cases other parents and advocates have made public so the community can
        learn from them. All identifying information about minors and private parties has been
        removed under each case's published redaction policy.
      </Body>
      <FlatList
        data={cases}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => (
          <Card>
            <H2>{item.publicTitle ?? item.title}</H2>
            <Body muted>
              {item.caseType} · {item.jurisdictionState}
              {item.jurisdictionCounty ? ` · ${item.jurisdictionCounty}` : ''} · {item.status}
              {item.isReferenceCase ? ' · Reference' : ''}
            </Body>
            {item.publicSummary ? <Body>{item.publicSummary}</Body> : null}
            <Button
              label="View case"
              onPress={() =>
                navigation.navigate('PublicCaseDetail', {
                  caseId: item.id,
                  slug: item.publicSlug,
                })
              }
            />
          </Card>
        )}
        ListEmptyComponent={
          <Card>
            <Body muted>No public reference cases yet.</Body>
          </Card>
        }
      />
    </Screen>
  );
}

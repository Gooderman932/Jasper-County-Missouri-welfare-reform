import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import { Body, Button, Card, H1, H2, Screen, SeverityBadge } from '@app/components/Common';
import { useApp, isPremium } from '@app/hooks/useApp';
import { CaseRecord, IssueFlag } from '@domain/entities';

export function HomeScreen({ navigation }: any) {
  const { container, user, entitlement, refreshEntitlement } = useApp();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [flags, setFlags] = useState<IssueFlag[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const list = await container.cases.listCases(user.id);
      setCases(list);
      const allFlags: IssueFlag[] = [];
      for (const c of list.slice(0, 5)) {
        const f = await container.issues.listIssueFlags(c.id);
        allFlags.push(...f);
      }
      setFlags(allFlags.slice(0, 8));
      await refreshEntitlement();
    } finally {
      setRefreshing(false);
    }
  }, [container, user, refreshEntitlement]);

  useEffect(() => {
    load();
  }, [load]);

  const premium = isPremium(entitlement);

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <H1>Welcome{user?.displayName ? `, ${user.displayName}` : ''}</H1>
        <Card>
          <H2>{premium ? 'Premium active' : 'Free tier'}</H2>
          <Body muted>
            {premium
              ? 'You have full access to review modules, pattern matching, attorney intake, and OCR.'
              : '1 month free, then $5.99/month. Auto-renews unless canceled in Google Play.'}
          </Body>
          {!premium && <Button label="See Premium" onPress={() => navigation.navigate('Paywall')} />}
        </Card>

        <H2>Your cases ({cases.length})</H2>
        {cases.length === 0 ? (
          <Card>
            <Body>No cases yet.</Body>
            <Button label="Create your first case" onPress={() => navigation.navigate('CreateFirstCase')} />
          </Card>
        ) : (
          cases.slice(0, 5).map((c) => (
            <Card key={c.id}>
              <Body style={{ fontWeight: '700' }}>{c.title}</Body>
              <Body muted>
                {c.caseType} · {c.jurisdictionState}
                {c.jurisdictionCounty ? ` · ${c.jurisdictionCounty}` : ''} · {c.status}
              </Body>
              <Button label="Open" variant="secondary" onPress={() => navigation.navigate('CaseDetail', { caseId: c.id })} />
            </Card>
          ))
        )}

        {flags.length > 0 && (
          <>
            <H2>Issue flags awaiting your review</H2>
            {flags.map((f) => (
              <Card key={f.id}>
                <SeverityBadge severity={f.severity} />
                <Body style={{ fontWeight: '600', marginTop: 4 }}>{f.summary}</Body>
                <Body muted>{f.explanation}</Body>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

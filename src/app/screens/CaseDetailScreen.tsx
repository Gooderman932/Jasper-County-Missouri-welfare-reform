import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import { format } from 'date-fns';
import { Body, Button, Card, H1, H2, Screen, SeverityBadge } from '@app/components/Common';
import { useApp } from '@app/hooks/useApp';
import { CaseEvent, CaseParty, CaseRecord, DocumentRecord, IssueFlag, PatternMatch } from '@domain/entities';

export function CaseDetailScreen({ route, navigation }: any) {
  const { caseId } = route.params;
  const { container } = useApp();
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [parties, setParties] = useState<CaseParty[]>([]);
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [flags, setFlags] = useState<IssueFlag[]>([]);
  const [patterns, setPatterns] = useState<PatternMatch[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      const [r, p, e, d, f, pat] = await Promise.all([
        container.cases.getCaseById(caseId),
        container.parties.listParties(caseId),
        container.events.listEvents(caseId),
        container.documents.listDocuments(caseId),
        container.issues.listIssueFlags(caseId),
        container.patterns.getPatternMatches(caseId),
      ]);
      setRecord(r);
      setParties(p);
      setEvents(e);
      setDocuments(d);
      setFlags(f);
      setPatterns(pat);
    } catch (err: any) {
      setLoadError(err?.message ?? 'Could not load case. Check your connection and try again.');
    } finally {
      setRefreshing(false);
    }
  }, [container, caseId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) {
    return (
      <Screen>
        <Body muted>{loadError}</Body>
        <Button label="Retry" onPress={load} />
      </Screen>
    );
  }

  if (!record) return <Screen><Body>Loading…</Body></Screen>;

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <H1>{record.title}</H1>
        <Body muted>
          {record.caseType} · {record.jurisdictionState}
          {record.jurisdictionCounty ? ` · ${record.jurisdictionCounty}` : ''} · {record.status}
        </Body>
        <Card>
          <Body style={{ fontWeight: '600' }}>
            Visibility: {record.visibility === 'public' ? '🌐 Public reference case' : '🔒 Private'}
          </Body>
          {record.visibility === 'public' && record.publicSlug ? (
            <Body muted>Public slug: /{record.publicSlug}</Body>
          ) : null}
          {record.visibility === 'public' ? (
            <Button
              label="Make private"
              variant="danger"
              onPress={() => navigation.navigate('UnpublishCase', { caseId: record.id })}
            />
          ) : (
            <Button
              label="Publish as reference case"
              variant="secondary"
              onPress={() => navigation.navigate('PublishCase', { caseId: record.id })}
            />
          )}
        </Card>

        <H2>Parties</H2>
        {parties.length === 0 ? <Body muted>No parties added.</Body> :
          parties.map((p) => (
            <Card key={p.id}>
              <Body style={{ fontWeight: '600' }}>{p.displayLabel}</Body>
              <Body muted>{p.role}</Body>
            </Card>
          ))}

        <H2>Timeline ({events.length})</H2>
        {events.map((e) => (
          <Card key={e.id}>
            <Body style={{ fontWeight: '600' }}>
              {format(new Date(e.occurredAt), 'yyyy-MM-dd')} — {e.eventType}
            </Body>
            <Body>{e.description}</Body>
            {e.tags.length > 0 && <Body muted>Tags: {e.tags.join(', ')}</Body>}
          </Card>
        ))}

        <H2>Documents ({documents.length})</H2>
        {documents.map((d) => (
          <Card key={d.id}>
            <Body style={{ fontWeight: '600' }}>{d.title}</Body>
            <Body muted>{d.category} · {d.mimeType}</Body>
          </Card>
        ))}

        <H2>Issue flags ({flags.length})</H2>
        {flags.map((f) => (
          <Card key={f.id}>
            <SeverityBadge severity={f.severity} />
            <Body style={{ fontWeight: '600', marginTop: 4 }}>{f.summary}</Body>
            <Body muted>{f.explanation}</Body>
          </Card>
        ))}

        <H2>Patterns ({patterns.length})</H2>
        {patterns.length === 0 ? (
          <Card><Body muted>No pattern matches yet. Opt in to coalition matching to compare anonymously with similar cases.</Body></Card>
        ) : (
          patterns.map((p) => (
            <Card key={p.id}>
              <Body style={{ fontWeight: '600' }}>{p.matchType} (score {p.score.toFixed(2)})</Body>
              <Body>{p.explanation}</Body>
              <Body muted>Issues: {p.matchedIssueTypes.join(', ')}</Body>
            </Card>
          ))
        )}

        <Button label="Go to Export" onPress={() => navigation.navigate('Export', { caseId })} />
        <Button label="Patterns & coalition" variant="secondary" onPress={() => navigation.navigate('Pattern', { caseId })} />
      </ScrollView>
    </Screen>
  );
}

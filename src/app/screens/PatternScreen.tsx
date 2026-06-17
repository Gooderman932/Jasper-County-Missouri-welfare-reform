import React, { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { Body, Button, Card, H1, H2, Screen } from '@app/components/Common';
import { useApp, isPremium } from '@app/hooks/useApp';
import { CoalitionOptIn, PatternMatch } from '@domain/entities';
import { COALITION_DISCLAIMER, PATTERN_DISCLAIMER } from '@shared/constants/disclaimers';

export function PatternScreen({ route, navigation }: any) {
  const { caseId } = route.params ?? {};
  const { container, user, entitlement } = useApp();
  const [patterns, setPatterns] = useState<PatternMatch[]>([]);
  const [optIn, setOptIn] = useState<CoalitionOptIn | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const p = await container.patterns.getPatternMatches(caseId);
        setPatterns(p);
        const o = await container.patterns.getCoalitionOptIn(caseId);
        setOptIn(o);
      } finally {
        setLoading(false);
      }
    })();
  }, [container, caseId]);

  const premium = isPremium(entitlement);

  const optInAll = async () => {
    if (!user) return;
    try {
      await container.usecases.submitCoalitionConsent({
        userId: user.id,
        caseId,
        consentToPatternMatching: true,
        consentToAnonymizedCohortStats: true,
        consentToAttorneyReview: true,
        consentToAdvocateReview: true,
      } as any);
      Alert.alert('Consent recorded', 'Your coalition opt-in has been saved.');
      const o = await container.patterns.getCoalitionOptIn(caseId);
      setOptIn(o);
    } catch (err: any) {
      Alert.alert('Could not save consent', err?.message ?? 'Try again.');
    }
  };

  const requestAttorney = async () => {
    try {
      await container.patterns.requestAttorneyReview(caseId);
      Alert.alert('Submitted', 'Your attorney/advocate review request has been queued.');
    } catch (err: any) {
      Alert.alert('Could not submit', err?.message ?? 'Try again.');
    }
  };

  return (
    <Screen>
      <ScrollView>
        <H1>Patterns & coalition</H1>
        <Card>
          <Body muted>{PATTERN_DISCLAIMER}</Body>
        </Card>

        {!premium && (
          <Card>
            <H2>Premium feature</H2>
            <Body muted>Pattern matching and attorney review require Premium.</Body>
            <Button label="See Premium" onPress={() => navigation.navigate('Paywall')} />
          </Card>
        )}

        <H2>Possible patterns</H2>
        {loading ? <Body muted>Loading…</Body> : patterns.length === 0 ? (
          <Card><Body muted>No pattern matches yet.</Body></Card>
        ) : patterns.map((p) => (
          <Card key={p.id}>
            <Body style={{ fontWeight: '600' }}>{p.matchType.replace(/_/g, ' ')}</Body>
            <Body>{p.explanation}</Body>
            <Body muted>Score: {p.score.toFixed(2)} · Visible cohort: {p.visibleCount}</Body>
            <Body muted>Issues: {p.matchedIssueTypes.join(', ')}</Body>
          </Card>
        ))}

        <Card>
          <H2>Coalition opt-in</H2>
          <Body muted>{COALITION_DISCLAIMER}</Body>
          {optIn ? (
            <>
              <Body style={{ marginTop: 8 }}>Pattern matching: {optIn.consentToPatternMatching ? 'yes' : 'no'}</Body>
              <Body>Cohort stats: {optIn.consentToAnonymizedCohortStats ? 'yes' : 'no'}</Body>
              <Body>Attorney review: {optIn.consentToAttorneyReview ? 'yes' : 'no'}</Body>
              <Body>Advocate review: {optIn.consentToAdvocateReview ? 'yes' : 'no'}</Body>
              {optIn.consentToAttorneyReview && <Button label="Submit to attorney review queue" onPress={requestAttorney} />}
            </>
          ) : (
            <Button label="Opt in to all (review consents)" onPress={optInAll} disabled={!premium} />
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

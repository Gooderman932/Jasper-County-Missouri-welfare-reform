import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, View, Text, StyleSheet } from 'react-native';
import { Body, Button, Card, H1, H2, Screen } from '@app/components/Common';
import { useApp, isPremium } from '@app/hooks/useApp';
import { theme } from '@app/theme';
import { CaseRecord } from '@domain/entities';
import { GuidedReviewAnswers } from '@domain/services/guidedReview';

type YN = boolean | undefined;
const TriToggle = ({ value, onChange, label }: { value: YN; onChange: (v: YN) => void; label: string }) => (
  <View style={{ marginVertical: 6 }}>
    <Text style={{ marginBottom: 4 }}>{label}</Text>
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {(['yes', 'no', 'unsure'] as const).map((k) => {
        const selected = (k === 'yes' && value === true) || (k === 'no' && value === false) || (k === 'unsure' && value === undefined);
        return (
          <Text
            key={k}
            onPress={() => onChange(k === 'yes' ? true : k === 'no' ? false : undefined)}
            style={[styles.pill, selected && { backgroundColor: theme.colors.primary, color: '#fff' }]}
          >
            {k}
          </Text>
        );
      })}
    </View>
  </View>
);

export function RightsReviewScreen({ navigation }: any) {
  const { container, user, entitlement } = useApp();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCase, setActiveCase] = useState<string | null>(null);
  const [answers, setAnswers] = useState<GuidedReviewAnswers>({ notice: {}, drugAllegation: {}, reasonableEfforts: {}, counsel: {}, hearingTiming: {}, visitation: {} });

  useEffect(() => {
    (async () => {
      if (!user) return;
      const list = await container.cases.listCases(user.id);
      setCases(list);
      if (list.length > 0 && !activeCase && list[0]) setActiveCase(list[0].id);
    })();
  }, [container, user, activeCase]);

  const premium = isPremium(entitlement);

  const runReview = async () => {
    if (!activeCase) return;
    try {
      const created = await container.usecases.runGuidedReview(activeCase, answers);
      Alert.alert('Review complete', `${created.length} possible issues flagged for review.`);
      navigation.navigate('CaseDetail', { caseId: activeCase });
    } catch (err: any) {
      Alert.alert('Could not run review', err?.message ?? 'Try again.');
    }
  };

  return (
    <Screen>
      <ScrollView>
        <H1>Guided rights review</H1>
        <Body muted>Each output is phrased as a possible issue to review with a licensed attorney. None are legal conclusions.</Body>

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
          <H2>Notice & service</H2>
          <TriToggle label="Were you served with a petition or court notice?" value={answers.notice?.servedWithPetition} onChange={(v) => setAnswers({ ...answers, notice: { ...answers.notice, servedWithPetition: v } })} />
          <TriToggle label="Did the notice include the hearing date and time?" value={answers.notice?.noticeIncludedHearingDateTime} onChange={(v) => setAnswers({ ...answers, notice: { ...answers.notice, noticeIncludedHearingDateTime: v } })} />
          <TriToggle label="Did you receive it far enough in advance to attend?" value={answers.notice?.receivedFarEnoughInAdvance} onChange={(v) => setAnswers({ ...answers, notice: { ...answers.notice, receivedFarEnoughInAdvance: v } })} />
          <TriToggle label="Did the court or agency use an old or wrong address?" value={answers.notice?.wrongOrOldAddressUsed} onChange={(v) => setAnswers({ ...answers, notice: { ...answers.notice, wrongOrOldAddressUsed: v } })} />
          <TriToggle label="Were hearings held without you after you provided contact info?" value={answers.notice?.hearingsHeldWithoutYouAfterContact} onChange={(v) => setAnswers({ ...answers, notice: { ...answers.notice, hearingsHeldWithoutYouAfterContact: v } })} />
        </Card>

        <Card>
          <H2>Reasonable efforts & service access</H2>
          <TriToggle label="Were ordered services available, affordable, and reachable?" value={answers.reasonableEfforts?.servicesAvailableAffordableReachable} onChange={(v) => setAnswers({ ...answers, reasonableEfforts: { ...answers.reasonableEfforts, servicesAvailableAffordableReachable: v } })} />
          <TriToggle label="Were barriers (transport, scheduling) documented?" value={answers.reasonableEfforts?.barriersDocumented} onChange={(v) => setAnswers({ ...answers, reasonableEfforts: { ...answers.reasonableEfforts, barriersDocumented: v } })} />
          <TriToggle label="Were missed services later cited against you?" value={answers.reasonableEfforts?.missedServicesCitedAgainstYou} onChange={(v) => setAnswers({ ...answers, reasonableEfforts: { ...answers.reasonableEfforts, missedServicesCitedAgainstYou: v } })} />
          <TriToggle label='Did the court recite "reasonable efforts" without specifics?' value={answers.reasonableEfforts?.reasonableEffortsRecitedWithoutSpecifics} onChange={(v) => setAnswers({ ...answers, reasonableEfforts: { ...answers.reasonableEfforts, reasonableEffortsRecitedWithoutSpecifics: v } })} />
        </Card>

        {premium ? (
          <>
            <Card>
              <H2>Drug-use allegations</H2>
              <TriToggle label="Was substance use alleged?" value={answers.drugAllegation?.substanceUseAlleged} onChange={(v) => setAnswers({ ...answers, drugAllegation: { ...answers.drugAllegation, substanceUseAlleged: v } })} />
              <TriToggle label="Was a diagnosis or incapacity finding actually stated?" value={answers.drugAllegation?.diagnosisOrIncapacityFinding} onChange={(v) => setAnswers({ ...answers, drugAllegation: { ...answers.drugAllegation, diagnosisOrIncapacityFinding: v } })} />
              <TriToggle label="Was the child shown to have been harmed because of substance use?" value={answers.drugAllegation?.documentedHarmToChild} onChange={(v) => setAnswers({ ...answers, drugAllegation: { ...answers.drugAllegation, documentedHarmToChild: v } })} />
              <TriToggle label="Were tests tied to specific parenting inability?" value={answers.drugAllegation?.testsTiedToParentingInability} onChange={(v) => setAnswers({ ...answers, drugAllegation: { ...answers.drugAllegation, testsTiedToParentingInability: v } })} />
            </Card>
            <Card>
              <H2>Counsel</H2>
              <TriToggle label="Were you offered counsel?" value={answers.counsel?.offeredCounsel} onChange={(v) => setAnswers({ ...answers, counsel: { ...answers.counsel, offeredCounsel: v } })} />
              <TriToggle label="Was counsel appointed in a timely manner?" value={answers.counsel?.appointedCounselTimely} onChange={(v) => setAnswers({ ...answers, counsel: { ...answers.counsel, appointedCounselTimely: v } })} />
              <TriToggle label="Did you have meaningful consultation before hearings?" value={answers.counsel?.meaningfulConsultationBeforeHearings} onChange={(v) => setAnswers({ ...answers, counsel: { ...answers.counsel, meaningfulConsultationBeforeHearings: v } })} />
            </Card>
            <Card>
              <H2>Hearing timing</H2>
              <TriToggle label="Were hearings held within statutory windows?" value={answers.hearingTiming?.hearingsHeldWithinStatutoryWindow} onChange={(v) => setAnswers({ ...answers, hearingTiming: { ...answers.hearingTiming, hearingsHeldWithinStatutoryWindow: v } })} />
              <TriToggle label="Were you able to participate (remote or in person)?" value={answers.hearingTiming?.abilityToParticipateRemoteOrInPerson} onChange={(v) => setAnswers({ ...answers, hearingTiming: { ...answers.hearingTiming, abilityToParticipateRemoteOrInPerson: v } })} />
            </Card>
            <Card>
              <H2>Visitation</H2>
              <TriToggle label="Was visitation ordered?" value={answers.visitation?.visitationOrdered} onChange={(v) => setAnswers({ ...answers, visitation: { ...answers.visitation, visitationOrdered: v } })} />
              <TriToggle label="Was visitation actually facilitated?" value={answers.visitation?.visitationActuallyFacilitated} onChange={(v) => setAnswers({ ...answers, visitation: { ...answers.visitation, visitationActuallyFacilitated: v } })} />
              <TriToggle label="Were cancellations logged against you?" value={answers.visitation?.cancellationsLoggedAgainstParent} onChange={(v) => setAnswers({ ...answers, visitation: { ...answers.visitation, cancellationsLoggedAgainstParent: v } })} />
            </Card>
          </>
        ) : (
          <Card>
            <H2>More modules available with Premium</H2>
            <Body muted>Drug-allegation, counsel, hearing-timing, visitation, and evidence-quality modules are part of Premium.</Body>
            <Button label="See Premium" variant="secondary" onPress={() => navigation.navigate('Paywall')} />
          </Card>
        )}

        <Button label="Generate possible issues for review" onPress={runReview} />
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

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ScrollView, View, Switch, Alert } from 'react-native';
import { Body, Button, Card, H1, H2, Screen } from '@app/components/Common';
import { useApp } from '@app/hooks/useApp';
import {
  CaseRecord,
  DocumentRecord,
  RedactionPolicy,
} from '@domain/entities';
import {
  RedactionContext,
  documentRedactionWarnings,
  isDocumentPublicUnderPolicy,
} from '@domain/services/redaction';
import { PUBLIC_CASE_CONSENT } from '@shared/constants/disclaimers';

/**
 * Owner-only flow that previews redaction warnings and publishes a case to
 * the public reference library after explicit consent.
 *
 * The actual permission swap + slug generation lives in
 * CaseRepository.publishCase — this screen is the consent UX.
 */
export function PublishCaseScreen({ route, navigation }: any) {
  const { caseId } = route.params;
  const { container, user } = useApp();
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [policy, setPolicy] = useState<RedactionPolicy>({
    childPii: 'initials_birthyear',
    ownerPii: 'initials_city',
    thirdParties: 'public_full_private_initials',
    documents: 'all_visible',
  });
  const [publicTitle, setPublicTitle] = useState<string>('');
  const [publicSummary, setPublicSummary] = useState<string>('');
  const [consent, setConsent] = useState({
    ownConsent: false,
    minorAcknowledged: false,
    notLegalAdvice: false,
    redactionReviewed: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [r, d] = await Promise.all([
      container.cases.getCaseById(caseId),
      container.documents.listDocuments(caseId),
    ]);
    setRecord(r);
    setDocuments(d);
    if (r) {
      setPublicTitle(r.publicTitle ?? r.title);
      setPublicSummary(r.publicSummary ?? '');
      if (r.redactionPolicy) setPolicy(r.redactionPolicy);
    }
  }, [container, caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const ctx: RedactionContext = useMemo(
    () => ({ policy, identities: [], minorDobs: [] }),
    [policy],
  );

  const warningsByDoc = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const d of documents) {
      map[d.id] = documentRedactionWarnings(d, ctx);
    }
    return map;
  }, [documents, ctx]);

  const publishableDocs = documents.filter((d) => isDocumentPublicUnderPolicy(d, policy));
  const hiddenDocs = documents.filter((d) => !isDocumentPublicUnderPolicy(d, policy));
  const totalWarnings = Object.values(warningsByDoc).reduce((acc, w) => acc + w.length, 0);

  const allConsented = Object.values(consent).every(Boolean);
  const canSubmit = !!record && !!user && allConsented && !submitting;

  const onSubmit = async () => {
    if (!record || !user) return;
    setSubmitting(true);
    try {
      const updated = await container.cases.publishCase({
        caseId: record.id,
        publishedByUserId: user.id,
        redactionPolicy: policy,
        publicTitle,
        publicSummary,
        isReferenceCase: !!record.isReferenceCase,
      });
      Alert.alert(
        'Case published',
        `Your case is now public at /${updated.publicSlug}. You can unpublish at any time.`,
      );
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Publish failed', err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!record) {
    return (
      <Screen>
        <Body>Loading…</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView>
        <H1>Publish case</H1>
        <Body muted>
          Making this case public means anyone (signed in or not) can view your timeline, issue
          flags, and the documents listed below. Identifying details about minors and private
          parties will be redacted under the policy you choose.
        </Body>

        <H2>Public title</H2>
        <Card>
          <Body style={{ fontWeight: '600' }}>{publicTitle || record.title}</Body>
          <Body muted>
            Edit by re-publishing later. (Inline editing UI lives in a follow-up.)
          </Body>
        </Card>

        <H2>Redaction policy</H2>
        <Card>
          <PolicyToggle
            label="Child PII: initials + birth year only"
            value={policy.childPii === 'initials_birthyear'}
            onChange={(v) =>
              setPolicy({ ...policy, childPii: v ? 'initials_birthyear' : 'initials_only' })
            }
          />
          <PolicyToggle
            label="My PII: initials + city/state only"
            value={policy.ownerPii === 'initials_city'}
            onChange={(v) =>
              setPolicy({ ...policy, ownerPii: v ? 'initials_city' : 'name_only' })
            }
          />
          <PolicyToggle
            label="Third parties: public officials full name, private parties initials only"
            value={policy.thirdParties === 'public_full_private_initials'}
            onChange={(v) =>
              setPolicy({
                ...policy,
                thirdParties: v ? 'public_full_private_initials' : 'all_initials',
              })
            }
          />
          <PolicyToggle
            label="Documents: show all (off = titles only)"
            value={policy.documents === 'all_visible'}
            onChange={(v) =>
              setPolicy({
                ...policy,
                documents: v ? 'all_visible' : 'titles_only',
              })
            }
          />
        </Card>

        <H2>Document review ({publishableDocs.length} public / {hiddenDocs.length} hidden)</H2>
        {publishableDocs.map((d) => (
          <Card key={d.id}>
            <Body style={{ fontWeight: '600' }}>{d.title}</Body>
            <Body muted>{d.category}</Body>
            {(warningsByDoc[d.id] ?? []).map((w, i) => (
              <Body key={i} style={{ color: '#dc2626', marginTop: 4 }}>⚠ {w}</Body>
            ))}
          </Card>
        ))}
        {hiddenDocs.length > 0 && (
          <Card>
            <Body style={{ fontWeight: '600' }}>Hidden from public view</Body>
            {hiddenDocs.map((d) => (
              <Body key={d.id} muted>
                • {d.title} ({d.category})
              </Body>
            ))}
          </Card>
        )}

        <H2>Required consent</H2>
        <Card>
          <Body muted>{PUBLIC_CASE_CONSENT}</Body>
        </Card>
        <Card>
          <ConsentRow
            label="I am the rightful owner of this case data and am authorized to publish it."
            value={consent.ownConsent}
            onChange={(v) => setConsent({ ...consent, ownConsent: v })}
          />
          <ConsentRow
            label="I understand minor children CANNOT consent. I am applying the strictest redaction available for them."
            value={consent.minorAcknowledged}
            onChange={(v) => setConsent({ ...consent, minorAcknowledged: v })}
          />
          <ConsentRow
            label="I understand this app is NOT legal advice and the publisher is responsible for what they post."
            value={consent.notLegalAdvice}
            onChange={(v) => setConsent({ ...consent, notLegalAdvice: v })}
          />
          <ConsentRow
            label={`I have reviewed each of the ${publishableDocs.length} public documents above${totalWarnings > 0 ? ` and the ${totalWarnings} warning(s)` : ''}.`}
            value={consent.redactionReviewed}
            onChange={(v) => setConsent({ ...consent, redactionReviewed: v })}
          />
        </Card>

        <Button
          label={submitting ? 'Publishing…' : 'Publish to public reference library'}
          onPress={onSubmit}
          disabled={!canSubmit}
        />
        <Button
          label="Cancel"
          variant="secondary"
          onPress={() => navigation.goBack()}
        />
      </ScrollView>
    </Screen>
  );
}

const PolicyToggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
    }}
  >
    <Body style={{ flex: 1, paddingRight: 12 }}>{label}</Body>
    <Switch value={value} onValueChange={onChange} />
  </View>
);

const ConsentRow: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
    }}
  >
    <Body style={{ flex: 1, paddingRight: 12 }}>{label}</Body>
    <Switch value={value} onValueChange={onChange} />
  </View>
);

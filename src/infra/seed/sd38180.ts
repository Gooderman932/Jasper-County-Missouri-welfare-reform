// Seed Case #1 — the appellant's real Missouri Court of Appeals Southern District case.
// Case No. SD38180 / lower court 22AO-JU00288 — IN THE INTEREST OF K.C.G.
// Auto-imported the first time the signed-in user has zero cases.
// All content based on documents provided by the user (Motion for Reconsideration filed
// 04/20/2024, Court of Appeals Order denying same dated 05/02/2024, Rule 83.04 Notice
// of Application for Transfer dated 05/17/2024).

import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { v4 as uuid } from 'uuid';
import { SD38180_EVENTS, SD38180_FLAGS } from './sd38180-data';

import {
  AuthRepository,
  CaseRepository,
  DocumentRepository,
  EventRepository,
  IssueReviewRepository,
  PartyRepository,
} from '@domain/repositories';

export interface SeedDeps {
  auth: AuthRepository;
  cases: CaseRepository;
  parties?: PartyRepository;
  events: EventRepository;
  documents: DocumentRepository;
  issues: IssueReviewRepository;
}

/**
 * Returns true if seeded, false if no-op (case already exists or user has other cases).
 */
export async function seedSD38180IfFirstRun(deps: SeedDeps): Promise<boolean> {
  const user = await deps.auth.getCurrentUser();
  if (!user) return false;
  const existing = await deps.cases.listCases(user.id);
  if (existing.some((c) => c.title.includes('SD38180') || c.title.includes('K.C.G'))) {
    return false; // already seeded
  }
  if (existing.length > 0) return false; // user already has cases; do not override

  // 1) Create the case
  const created = await deps.cases.createCase({
    ownerUserId: user.id,
    title: 'In the Interest of K.C.G. — Appeal No. SD38180 (22AO-JU00288)',
    jurisdictionState: 'MO',
    jurisdictionCounty: 'Jasper',
    caseType: 'appeal',
  });

  // 2) Parties (optional repo — many infra builds use a single CaseParty repo wired here)
  if (deps.parties) {
    await deps.parties.addParty(created.id, {
      role: 'father',
      displayLabel: 'M.P.G. (Appellant)',
      legalName: 'Matthew Preston Goodman',
    });
    await deps.parties.addParty(created.id, {
      role: 'child',
      displayLabel: 'K.C.G.',
      anonymizedLabel: 'K.C.G.',
      isMinor: true,
    });
    await deps.parties.addParty(created.id, {
      role: 'mother',
      displayLabel: 'B.L.M.',
    });
    await deps.parties.addParty(created.id, {
      role: 'foster_parent',
      displayLabel: 'C.T.A.M.',
    });
    await deps.parties.addParty(created.id, {
      role: 'juvenile_officer',
      displayLabel: 'Jasper County Juvenile Office',
    });
    await deps.parties.addParty(created.id, {
      role: 'judge',
      displayLabel: 'Judge Angela Vorhees',
    });
    await deps.parties.addParty(created.id, {
      role: 'attorney',
      displayLabel: 'Kathleen Wolf Miller (former pro bono — withdrew)',
    });
    await deps.parties.addParty(created.id, {
      role: 'attorney',
      displayLabel: 'Ron Sparling (court-appointed 2/23/2021 — appellant unaware)',
    });
    await deps.parties.addParty(created.id, {
      role: 'attorney',
      displayLabel: 'Spellman Robertson (appointed 10/26/2022)',
    });
    await deps.parties.addParty(created.id, {
      role: 'caseworker',
      displayLabel: 'Mellisa Holcomb',
    });
    await deps.parties.addParty(created.id, {
      role: 'caseworker',
      displayLabel: 'Jennifer Emmons — Social Services Unit Supervisor, Mo. DSS Children’s Division (Jasper Co.)',
    });
    await deps.parties.addParty(created.id, {
      role: 'caseworker',
      displayLabel: 'Shania Riley — Social Services Specialist, Mo. DSS Children’s Division (Jasper Co., Joplin office 601 Commercial St.)',
    });
    await deps.parties.addParty(created.id, {
      role: 'caseworker',
      displayLabel: 'Brian Garrity, MSW — Circuit Manager, 29th Circuit (Jasper Co.), Mo. DSS Children’s Division',
    });
    await deps.parties.addParty(created.id, {
      role: 'caseworker',
      displayLabel: 'Shannon R. "Shay" Ewing — Benefit Program Specialist, Financials/Child Support Alternate Care, Mo. DSS FSD (Rolla MO office 1111 Kingshwy Ste D)',
    });
  }

  // 3) Timeline events drawn from the Motion for Reconsideration narrative
  const events = SD38180_EVENTS;

  for (const e of events) {
    await deps.events.addEvent({
      caseId: created.id,
      eventType: e.type,
      occurredAt: new Date(e.at).toISOString(),
      description: e.desc,
      tags: e.tags ?? [],
    });
  }

  // 4) Seed documents — uploads three bundled PDFs into the user's raw-documents bucket.
  try {
    const bundled = [
      {
        title: 'Motion for Reconsideration / En Banc Transfer / 42 U.S.C. \u00a7 1983 (filed 4/20/2024)',
        category: 'petition' as const,
        module: require('../../../assets/seed-case-sd38180/38180-Motion-by-Appellant_FINAL_CONFIDENTIAL-2.pdf'),
        mimeType: 'application/pdf',
        tags: ['motion-for-reconsideration', '1983', 'ex-parte-young'],
      },
      {
        title: 'Order Denying Motion for Rehearing and Application for Transfer (filed 5/2/2024)',
        category: 'court_order' as const,
        module: require('../../../assets/seed-case-sd38180/SD38180-Order-Denying-Appellant-s-Motion-for-Rehearing-and-Application-for-Transfer_FINAL_CONFIDENTIAL.pdf'),
        mimeType: 'application/pdf',
        tags: ['order', 'rule-83.04', 'denied'],
      },
      {
        title: 'NOTICE Rule 83.04 Application for Transfer to Mo. Sup. Ct. (sent 5/17/2024)',
        category: 'correspondence' as const,
        module: require('../../../assets/seed-case-sd38180/Gmail-NOTICE-Rule-83.04-Application-for-transfer-1.pdf'),
        mimeType: 'application/pdf',
        tags: ['supreme-court-transfer', 'notice'],
      },
      // ---- Evidentiary emails to/from DSS Children's Division staff ----
      {
        title: 'Email: J. Emmons (DSS Supervisor) — "Checking In" (12/7/2021) — supervisor confirms she has not heard from Wolf Miller',
        category: 'correspondence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Checking-In-1-2.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'dss', 'counsel-non-communication', 'jennifer-emmons', '2021-12-07'],
      },
      {
        title: 'Email: J. Emmons (DSS Supervisor) — "Checking In" duplicate (12/7/2021)',
        category: 'correspondence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Checking-In-1-4.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'dss', 'duplicate-copy', '2021-12-07'],
      },
      {
        title: 'Email: J. Emmons (DSS) — "Next Meeting" 6/6/2022 (sent 4/12/2022 to K. Wolf Miller + appellant)',
        category: 'correspondence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Next-Meeting-3.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'dss', 'meeting-notice', 'wolf-miller', '2022-04-12'],
      },
      {
        title: 'Email: Appellant → Emmons/Riley — "Drug test at beginning and now present all negative" (5/7/2022) — forwarded grievance to B. Garrity',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Drug-test-at-beginning-an-now-present-all-negative-4.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'drug-tests-negative', 'grievance', 'brian-garrity', '2022-05-07'],
      },
      {
        title: 'Email thread: Appellant ↔ S. Riley & B. Garrity — "Address Correction" (7/21–7/26/2022) — wrong-address admission',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Re_-Re_-Address-Correction.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'wrong-address', 'service-defect', 'shania-riley', '2022-07-26'],
      },
      // ---- Court-continuance, ICPC/background-check, abuse-of-discretion thread ----
      {
        title: 'Email: J. Emmons → K. Wolf Miller + Appellant — "Court Continuance" (3/8/2022) — hearing reset 3/8 → 3/31/2022 [forwarded by appellant to ACLU-MO 3/16/2022]',
        category: 'correspondence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Court-Continuance-2.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'dss', 'court-continuance', 'aclu-mo', 'wolf-miller', '2022-03-08', '2022-03-16'],
      },
      {
        title: 'Email: J. Emmons → Appellant + K. Wolf Miller — "New Case Manager" (4/18/2022) — case transferred from Emmons to Shania Riley',
        category: 'correspondence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/New-Case-Manager-5.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'dss', 'caseworker-transfer', 'jennifer-emmons', 'shania-riley', '2022-04-18'],
      },
      {
        title: 'Email thread: Appellant ↔ J. Emmons — "Information request" (5/31/2022) — disputes adequacy of background check vs. statutory MULES requirement; appellant requests grievance form',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Information-request-3.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'mules', 'background-check', 'icpc', 'grievance', 'jennifer-emmons', '2022-05-31'],
      },
      {
        title: 'Email thread: Appellant ↔ J. Emmons — "Re: abuse of discretion re: K.G." (5/31/2022–6/9/2023) — KS-jurisdiction dispute, ICPC demand, formal notice of intended §1983 suit',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Re_-abuse-of-discretion-re_-K.G.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'jurisdiction-ks', 'icpc-demand', '1983-notice', 'jennifer-emmons', '2022-05-31', '2023-06-09'],
      },
      {
        title: 'Email: Mail Delivery Subsystem — "Documents requested to be submitted to judge by Jennifer Emmons" bounce (5/7/2022) — message too large; appellant’s attempt to send documentation directly to DSS failed at the SMTP layer',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Documents-requested-to-be-submitted-to-judge-by-Jennifer-Emmons-4.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'bounce', 'documents-to-judge', '2022-05-07'],
      },
      {
        title: 'Email: S. Riley → Appellant — "RE: Re: criminal history" (9/20/2022) — DSS confirms correct KS address "8681 SE 71ST ST BAXTER SPRINGS, KS 66713–4105"; hair-follicle scheduled 9/21/22; paper court review 11/10',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Re_-Re_-criminal-history.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'address-confirmed-ks', 'hair-follicle', 'paper-review', 'shania-riley', '2022-09-20'],
      },
      {
        title: 'Email: BeenVerified — "Your results are ready" search on Jennifer Emmons (6/30/2021) — appellant’s contemporaneous record of investigating supervisor early in case',
        category: 'correspondence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Your-results-are-ready.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'beenverified', 'jennifer-emmons', '2021-06-30'],
      },
      {
        title: 'Email: BeenVerified — "Results on Jennifer are ready" reminder (7/1/2021) — follow-up reminder for the supervisor records-check',
        category: 'correspondence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Results-on-Jennifer-are-ready-2.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'beenverified', 'jennifer-emmons', 'reminder', '2021-07-01'],
      },
      {
        title: 'Email thread: Appellant ↔ J. Emmons — "RE: FW: Matthew Goodman" (8/25–8/27/2021) — Emmons admits DSS "no longer do the Written Service Agreements that require signatures"; case plan never reduced to signed document',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/FW_-Matthew-Goodman.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'no-signed-case-plan', 'written-service-agreement', 'jennifer-emmons', 'wolf-miller', '2021-08-25', '2021-08-27'],
      },
      {
        title: 'Email: Appellant → Court Clerks + Bonita Gregory (CRU) + Mo./Ks. DSS + Janet Kuntzsch (KS DCF) — "My cs13q form I’m filing.pdf" (4/27/2022); CRU confirmed 4/28/2022 grievance routed to Circuit Manager',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/My-cs13q-form-I-m-filing.pdf-4.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'cs13q', 'grievance', 'bonita-gregory', 'cru', 'janet-kuntzsch', 'ks-dcf', '2022-04-27', '2022-04-28'],
      },
      {
        title: 'Email thread: Appellant ↔ S. Riley/Emmons/Garrity — "RE: Re: Drug Alcohol Evaluation and mental health evaluation" (7/26–8/9/2022) — Riley admits team blocked ICPC "due to your pending drug charges"; appellant raises alleged sexual abuse of K.C.G. by Trace in foster placement',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Re_-Re_-Drug-Alcohol-Evaluation-and-mental-health-evaluation-3.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'icpc-blocked', 'pending-drug-charges', 'foster-placement-safety', 'sibling-incident', 'shania-riley', 'brian-garrity', '2022-08-09'],
      },
      {
        title: 'Email thread: Appellant ↔ J. Emmons — "RE: parents" (4/4–4/5/2022) — Emmons invokes 15-of-22-month AFSA timeline as basis for moving away from reunification; tells appellant Kody will begin Pre-K in Marionville in fall; appellant raises lack of contract / voluntary case plan / lack of trial / insufficient counsel',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Re_-parents.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'afsa-15-of-22', 'goal-change-rationale', 'no-trial-yet', 'insufficient-counsel', 'marionville-pre-k', 'jennifer-emmons', '2022-04-04', '2022-04-05'],
      },
      {
        title: 'Email: Appellant → S. Riley + J. Emmons (later fwd to B. Garrity) — "Evaluations" (7/13–7/15/2022) — appellant confirms signed 90-day releases for drug/alcohol and mental-health evaluations',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Evaluations-3.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'evaluations-completed', 'release-signed', 'shania-riley', 'jennifer-emmons', 'brian-garrity', '2022-07-13', '2022-07-15'],
      },
      {
        title: 'Email: Mail Delivery Subsystem — bounce for `MAILER-DAEMON@oscsa0005.courts.state.mo.us` (5/24/2022) — NXDOMAIN; appellant’s attempted filing routed to a non-existent Mo. Courts subdomain',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/no-subject-1-2.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'bounce', 'nxdomain', 'mo-courts', '2022-05-24'],
      },
      {
        title: 'Email: Appellant → FSD CRU (Constituent Response Unit, dss.mo.gov) — (no-subject, 4/27/2022) — part of CS-13Q grievance submission burst',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/no-subject-2-4.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'cs13q', 'fsd-cru', 'grievance', '2022-04-27'],
      },
      {
        title: 'Email thread: J. Emmons ↔ Appellant — "RE: Court Tomorrow-Canceled" (2/4–2/7/2022) — foster mom Brenda gave notice the boys had to be moved; appellant requested K.C.G. be placed with him as father; Emmons confirms goal-change-to-adoption hearing pending; jurisdiction dispute (Mo. vs. Ks.)',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Court-Tomorrow-Canceled-4.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'foster-disruption', 'brenda-notice', 'placement-with-father-request', 'jurisdiction-dispute', 'goal-change-adoption', 'jennifer-emmons', '2022-02-04', '2022-02-07'],
      },
      {
        title: 'Email: Appellant → J. Emmons + S. Riley — "Evidence requested dfs" (5/7/2022) — forwarded grievance to B. Garrity attaching DNA / evidence; precursor to formal grievance burst (followed by CS-13Q on 4/27 and Garrity callback request on 5/4)',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Evidence-requested-dfs.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'grievance', 'dna-evidence', 'brian-garrity', '2022-05-07'],
      },
      {
        title: 'Email thread: J. Emmons ↔ Appellant — "RE: FW: ALTON GOODMAN CORRECTED NOTICE OF MTM HRG RESET 21-2/3" (4/1–4/5/2022) — Emmons states: "We do not have trials in juvenile court"; appellant explicitly invokes due-process / insufficient counsel; Emmons offers to send new application for court-appointed counsel but warns judge "made it clear we are moving forward with the hearing one way or another"',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/FW_-ALTON-GOODMAN-CORRECTED-NOTICE-OF-MTM-HRG-RESET-21-2_3.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'no-trial-juvenile-court', 'due-process', 'insufficient-counsel', 'court-appointed-counsel-app', 'mtm-hearing', 'goal-change', 'jennifer-emmons', '2022-04-01', '2022-04-05'],
      },
      {
        title: 'Email: Mail Delivery Subsystem — bounce "K.G-21AO-JU00003" from MAILER-DAEMON@oscsa0005.courts.state.mo.us (3/16/2022) — contemporaneous evidence that filings related to Mo. juvenile case-number "21AO-JU00003" were bouncing from Mo. Courts SMTP at the same time as appellant’s ACLU referral',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/K.G-21A0-JU00003-4.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'bounce', 'mo-courts', 'court-case-21AO-JU00003', '2022-03-16'],
      },
      {
        title: 'Email: Appellant → dsrp977@gmail.com (no-subject, 4/27/2022) — part of grievance-day mass send (companion to CS-13Q + FSD-CRU sends)',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/no-subject-3.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'grievance-day', '2022-04-27'],
      },
      {
        title: 'Email: Appellant → dls.dmu@dss.mo.gov (Disability Law / Mediation Unit, no-subject, 4/27/2022) — part of grievance-day mass send (companion to CS-13Q + FSD-CRU sends)',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/no-subject-4.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'grievance-day', 'dls-dmu', '2022-04-27'],
      },
      {
        title: 'Email thread: Appellant ↔ J. Emmons — "RE: Update" (3/16/2022, citing prior 7/16/2021 JO position) — appellant’s formal pro-se notice of intent to bring civil suit invoking 4th/14th Amendments and parent’s presumed fitness; Emmons confirms she copies Wolf Miller, JO, GAL, and supervisor on emails',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Update-4.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'pro-se-notice', 'civil-rights-suit', '4th-amendment', '14th-amendment', 'parental-fitness', 'cc-chain', 'jennifer-emmons', '2022-03-16', '2021-07-16'],
      },
      {
        title: 'Email thread: S. Riley ↔ Appellant — "RE: Monthly contact" (4/25–4/27/2023) — Riley confirms TPR hearing scheduled May 23, 2023 at 10AM; appellant recounts on-record statement by Emmons that hair-follicle "wouldn’t matter and she would not change the case goal back to reunification"; ongoing personal-jurisdiction objection',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Monthly-contact-3.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'tpr-date', '2023-05-23', 'hair-follicle', 'reasonable-efforts-impeachment', 'personal-jurisdiction', 'shania-riley', '2023-04-25', '2023-04-27'],
      },
      {
        title: 'Email thread: J. Emmons ↔ Appellant — "RE: FW: ALTON/GOODMAN NOTICE OF HEARING" (2/4–2/7/2022) — appellant formally invokes lack of personal jurisdiction as respondent; asks for missed visitation makeup; Ginger / Dawndee referenced as visit supervisor / co-parent contacts',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/FW_-ALTON_GOODMAN-NOTICE-OF-HEARING-5.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'personal-jurisdiction-objection', 'notice-of-hearing', 'visitation', 'jennifer-emmons', '2022-02-04', '2022-02-07'],
      },
      {
        title: 'Email: J. Emmons auto-reply (7/23/2022) — "Out of office 7/22–8/1, contact supervisor Brian Garrity at brian.garrity@dss.mo.gov or 417-629-3211" — timeline marker for Garrity escalation window',
        category: 'correspondence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Automatic-reply_-Re_-Drug-Alcohol-Evaluation-and-mental-health-evaluation-2.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'auto-reply', 'jennifer-emmons', 'brian-garrity', '2022-07-23'],
      },
      {
        title: 'Email: Mail Delivery Subsystem — bounce "K.G-21AO-JU00003" (3/16/2022, second copy) — same returned-mail notice from oscsa0005.courts.state.mo.us; duplicates / cross-references the earlier bounce',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/K.G-21A0-JU00003.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'bounce', 'mo-courts', 'court-case-21AO-JU00003', 'duplicate', '2022-03-16'],
      },
      {
        title: 'Email thread: J. Emmons → Appellant — "Checking In" (10/14/2021) — supervisor STILL has not heard from Wolf Miller 10 months into case; appellant confirms he is seeing her on 10/20',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Checking-In-2.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'counsel-non-communication', 'wolf-miller', 'jennifer-emmons', '2021-10-14'],
      },
      {
        title: 'Email thread: J. Emmons → Appellant — "Meeting" (11/10/2021) — next case meeting set for 12/8/2021 at 11:00 AM; supervisor notes attorney also notified',
        category: 'correspondence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Meeting.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'meeting-notice', 'jennifer-emmons', 'wolf-miller', '2021-11-10', '2021-12-08'],
      },
      {
        title: 'Email: J. Emmons → Appellant — "Update" (3/1/2022) — children placed over the weekend with Dawndee’s great-aunt and husband (maternal kin); appellant’s brother "never did hear from"; supervisor STILL has not heard from Wolf Miller week-of-court',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Update-1-4.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'kin-placement-maternal', 'paternal-kin-ignored', 'counsel-non-communication', 'jennifer-emmons', '2022-03-01'],
      },
      {
        title: 'Email: Appellant → J. Emmons + S. Riley — "Fwd: Grievance home prior to Kody’s removal" (5/7/2022) — submitted to Garrity attaching home/employment evidence (Goodman Remodel & Rentals — photos & docs of pre-removal residence)',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/Fwd_-Grievance-home-prior-to-Kodys-removal-5.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'grievance', 'home-evidence', 'employment-evidence', 'goodman-remodel-rentals', 'brian-garrity', '2022-05-07'],
      },
      {
        title: 'Email: Appellant → J. Emmons + S. Riley — "Deed" (no-subject, 5/7/2022) — forwarded to Garrity grievance: property deed proving KS residency',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/no-subject-5.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'grievance', 'deed', 'ks-residency', 'brian-garrity', '2022-05-07'],
      },
      {
        title: 'Email: Mail Delivery Subsystem — bounce for `MAILER-DAEMON@smpsa0002.courts.state.mo.us` (5/24/2022) — NXDOMAIN; second Mo. Courts subdomain returning bounces (companion to the oscsa0005 bounce of same date)',
        category: 'evidence' as const,
        module: require('../../../assets/seed-case-sd38180/emails/no-subject-6-5.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'bounce', 'nxdomain', 'mo-courts', 'smpsa0002', '2022-05-24'],
      },
      // ---- Batch 9: Webex/FST, NXDOMAIN bounce to JO complaint inbox, attorney-letterhead voicemail, answer-to-petition draft, address-correction colloquy ----
      {
        title: 'Webex/FST 90-Day Meeting — Alton/Goodman-21-002/003 (8/25/2021): Emmons admits no case plan submitted to appellant\u2019s attorney; hair-follicle court order; psych eval gated on 90 days sobriety; "most court hearings by paper" (no in-person without attorney request)',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Webex-FST-Alton-Goodman-21-002-003-90-Day.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2021-08-25', '2021-07-01', 'fst', '90-day', 'webex', 'no-case-plan-to-attorney', 'hearings-by-paper', 'hair-follicle', 'jennifer-emmons', 'wolf-miller'],
      },
      {
        title: 'Mail Delivery Subsystem — NXDOMAIN bounce to complaint.juvenile.officer@courts.mo.gov (5/24/2022): appellant\u2019s attempt to file a JO complaint to the published address rejected as "No such user" (550 5.1.1)',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Complaint-A-bounce.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'bounce', 'nxdomain', '2022-05-24', 'juvenile-officer-complaint', 'smpsa0002', 'mo-courts', 'access-to-process'],
      },
      {
        title: 'Following Up (9/9/2021): Emmons left voicemail for Kathleen Wolf Miller asking whether she wants Emmons to put the case plan on DSS letterhead for her \u2014 attorney still non-responsive at month 7',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Following-Up-3.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2021-09-09', 'counsel-non-communication', 'jennifer-emmons', 'wolf-miller', 'case-plan-letterhead'],
      },
      {
        title: 'Answer to Petition — Final (10/11/2022): appellant self-shares his draft Answer to the Children\u2019s Division petition (pro se preparation while represented by counsel)',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Answer-to-Petition-Final-shared.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-10-11', 'answer-to-petition', 'pro-se-preparation', 'self-share'],
      },
      {
        title: 'Drug Test Results \u2014 Negative (5/7/2022, batch 5): forwarded chain confirms appellant submitted negative drug test results to Garrity; Garrity tried to call but appellant\u2019s voicemail was full (417-629-3211 direct desk line)',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Drug-test-negative-fwd-Garrity-5.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-05-04', '2022-05-07', 'drug-test-negative', 'brian-garrity', 'voicemail-full', 'grievance'],
      },
      {
        title: 'Re: Re: Address Correction (7/26/2022, batch 5): Riley asks current address; appellant gives 8681 SE 71st, Baxter Springs KS 66713 and explicitly states the case file\u2019s "Carthage MO" entry is incorrect and "because of this I was not properly served the correct address at the beginning of the case"; appellant says he couldn\u2019t flag it earlier because he was unable to get a copy of the case file',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Re-Re-Address-Correction-5.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-07-26', 'service-of-process', 'wrong-address', 'baxter-springs-ks', 'case-file-access', 'shania-riley', 'mental-health-eval-no-criteria'],
      },
      {
        title: 'Checking In (12/7/2021, batch 7): duplicate of 12/7/2021 reminder \u2014 11am meeting next day, Emmons "still have not heard anything from your attorney" (Wolf Miller at month 10)',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Checking-In-1-7.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2021-12-07', 'counsel-non-communication', 'jennifer-emmons', 'wolf-miller', 'duplicate'],
      },
      // ---- Batch 10: pre-trial docketing confirmation, message-too-large bounce, additional duplicate-fwd evidence chain ----
      {
        title: 'Contact (6/12/2023): Riley\u2019s pre-trial confirmation \u2014 15 days before TPR trial \u2014 listing exactly which child-support checks were docketed (2022 tax return; 4/21/2023 $195; 5/12/2023 ~$80; 5/16/2023 $550; 5/30/2023 $325) and reminding appellant of trial 6/27/2023 10AM at 530 Pearl Ave, Joplin, MO 64801',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Contact-3-child-support-docketing.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2023-06-12', 'pre-trial', 'child-support', 'docketing', 'tpr-trial-reminder', 'shania-riley', '530-pearl-ave'],
      },
      {
        title: 'Documents Requested by Emmons (5/7/2022) \u2014 Google Mailer Daemon bounce 550 5.7.0 Message Size Violation to jennifer.emmons@dss.mo.gov and shania.riley@dss.mo.gov (second instance \u2014 evidence document submission obstructed by DSS inbox size limits)',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Documents-requested-bounce-1-2.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', 'bounce', 'message-too-large', '2022-05-07', 'jennifer-emmons', 'shania-riley', 'evidence-obstruction'],
      },
      {
        title: 'Drug Test \u2014 Negative (5/7/2022, batch 1-3): forwarded chain to Emmons & Riley of original grievance-to-Garrity email submitting negative drug test \u2014 demonstrates appellant routed evidence to multiple DSS staff after Garrity outreach',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Drug-test-negative-fwd-Garrity-1-3.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-05-07', 'drug-test-negative', 'grievance-fwd', 'jennifer-emmons', 'shania-riley', 'brian-garrity'],
      },
      {
        title: 'Evidence requested DFS \u2014 DNA (5/7/2022, batch 1-3): forwarded chain to Emmons & Riley of grievance-to-Garrity submission of DNA evidence \u2014 corroborates appellant\u2019s biological-paternity documentation effort',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Evidence-requested-dfs-1-3.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-05-07', 'dna-evidence', 'paternity', 'jennifer-emmons', 'shania-riley', 'brian-garrity'],
      },
      {
        title: 'Fwd: Grievance \u2014 home prior to Kody\u2019s removal (5/7/2022, batch 1-3): forwarded to Emmons & Riley of grievance-to-Garrity submission documenting the Goodman Remodel & Rentals home as it was when purchased prior to repairs (housing-stability evidence)',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Fwd-Grievance-home-prior-to-Kody-removal-1-3.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-05-07', 'housing-evidence', 'goodman-remodel-rentals', 'jennifer-emmons', 'shania-riley', 'brian-garrity'],
      },
      {
        title: 'Next Meeting (4/12/2022, primary copy): Emmons emails BOTH appellant and Kathleen Wolf Miller (kwmattyatlaw@gmail.com) scheduling regular 6-month case-progress meeting for 6/6/2022 1pm at 601 Commercial, Joplin \u2014 documents the meeting timeline and confirms Wolf Miller\u2019s active personal email account',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Next-Meeting.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-04-12', '2022-06-06', 'six-month-meeting', 'jennifer-emmons', 'wolf-miller', 'kwmattyatlaw'],
      },
      {
        title: 'Next Meeting (4/12/2022, batch 4 duplicate): same 6/6/2022 6-month meeting notice cc\u2019d to Wolf Miller \u2014 second saved copy confirming receipt',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Next-Meeting-4.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-04-12', 'six-month-meeting', 'duplicate', 'jennifer-emmons', 'wolf-miller'],
      },
      // ---- Batch 11: pre-trial 1983 notice-of-suit, missed-visits inquiry, repeated Spring River records-failure, evaluation-release effort ----
      {
        title: 'Re: abuse of discretion re: K.G (6/9/2023, batch 1): appellant\u2019s FINAL pre-trial §1983 notice-of-suit to Emmons cc Riley/Garrity \u2014 just 18 days before TPR trial \u2014 invoking KS jurisdiction, deed predating MO removal, lease in MO not yet expired, KS taxes, girlfriend\u2019s KS-based disability; preserves "failure to investigate placement with biological father" / ICPC / Children\u2019s Haven access-denial claims; explicit "notice of intended suit if not cured \u2026 will seek remedy in the district courts"',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Re-abuse-of-discretion-KG-1-final-1983-notice.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2023-06-09', '2022-05-31', 'pre-trial', '1983-notice', 'abuse-of-discretion', 'ks-jurisdiction', 'icpc', 'childrens-haven', 'biological-father-placement', 'jennifer-emmons'],
      },
      {
        title: 'No subject (5/25/2022): appellant emails Riley at 5:16pm \u2014 "second week I have not seen my boys because they didn\u2019t show up"; talked to Ginger, who didn\u2019t know where the boys were; visitation interference / placement-instability evidence',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/no-subject-11-2-missed-visits.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-05-25', 'missed-visits', 'visitation-interference', 'foster-ginger', 'placement-instability', 'shania-riley'],
      },
      {
        title: 'Fwd: Evaluations (7/13\u20137/15/2022, batch 1-4): appellant tells DSS he signed releases for BOTH drug/alcohol and mental-health evaluations (completed 7/13/2022); sent photo; release good for 90 days; "time is of the essence" \u2014 proof of active compliance with court-ordered assessments',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Evaluations-1-4.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-07-13', '2022-07-15', 'evaluations-complete', 'release-signed', 'drug-alcohol-eval', 'mental-health-eval', 'compliance', 'shania-riley', 'jennifer-emmons', 'brian-garrity'],
      },
      {
        title: 'Fwd: Evaluations (7/13\u20137/15/2022, batch 2-3): duplicate of evaluations-release email to Riley/Emmons forwarded to Garrity \u2014 secondary copy confirming multi-recipient delivery effort',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Evaluations-2-3.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-07-13', '2022-07-15', 'evaluations-complete', 'duplicate', 'brian-garrity'],
      },
      {
        title: 'Re: Re: Address Correction (7/26/2022, batch 2-5): duplicate of wrong-address admission chain \u2014 "the case file says 8681 SE 71st Carthage MO… because of this I was not properly served the correct address"',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Re-Re-Address-Correction-2-5.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-07-26', 'service-of-process', 'wrong-address', 'duplicate'],
      },
      {
        title: 'Re: Re: Address Correction (7/26/2022, batch 1-6): another duplicate of the wrong-address service-of-process admission chain \u2014 sixth saved copy confirms the chain was repeatedly preserved by appellant',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Re-Re-Address-Correction-1-6.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-07-26', 'service-of-process', 'wrong-address', 'duplicate'],
      },
      {
        title: 'Re: Re: (6/23\u20137/25/2022, no-subject-10-7): Riley repeatedly tries to fax-request Spring River records; provider responds "no records for you"; Riley promises to retry with dates and ask for more specific records; offers to meet appellant at church Wednesday to pick up paper copy \u2014 documents DSS\u2019s inability to obtain evaluation records through normal channels and appellant\u2019s willingness to hand-deliver',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/no-subject-10-7-spring-river-fax-fail.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-06-23', '2022-06-26', '2022-06-27', '2022-07-25', 'spring-river-no-records', 'records-failure', 'hand-delivery-offer', 'shania-riley'],
      },
      // ---- Batch 12: ICPC-blocked admission, attorney-phone-number-passthrough, child-support good-cause path, Marionville pre-K letter-of-enrollment ----
      {
        title: 'Re: Information request (5/31/2022, batch 1-3): KEY ADMISSION by Supervisor Emmons \u2014 "An initial background check is always completed… We found the pending drug charges and the team was not in agreement to move forward with ICPC. The court ordered you to complete a hair follicle to prove sobriety which you have not done 16 months later." Appellant rebuts that CaseNet is NOT a criminal background check under MO statute, and that pending/dismissed charges do not constitute a criminal record; alleges Jasper County conspired to deny constitutional rights ("arrested me for stealing my own car")',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Information-request-1-3-MULES-vs-CaseNet.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-05-31', 'icpc-blocked', 'pending-charges', 'hair-follicle', 'casenet-not-background-check', 'mules', 'arrested-for-own-car', 'jennifer-emmons', 'admission'],
      },
      {
        title: 'RE: Wednesdays visit (2/15\u20132/16/2023): Riley provides appellant the phone number for his own attorney (913-486-9247) \u2014 because appellant did not have it; Riley emails attorney asking for preferred method of communication; Riley confirms gifts/letters must be mailed to 601 Commercial St, Joplin; offers 2-hour visit twice a month if appellant can return to MO from KS \u2014 documents counsel-non-communication AND DSS willingness to facilitate visitation appellant tried to use',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Wednesdays-visit-Riley-2hr-twice-monthly.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2023-02-15', '2023-02-16', 'counsel-no-contact', 'attorney-phone-913-486-9247', 'visitation-2hr-twice-monthly', 'gifts-601-commercial', 'shania-riley'],
      },
      {
        title: 'Re: Your child support case with foster care #51588021 (6/14\u201312/28/2022): Shannon R. Ewing (Benefit Program Specialist \u2014 Financials, Child Support Alternate Care, 1111 Kingshwy Ste D, Rolla MO 65401) explains the FSD letter is auto-generated and shows $0.00 due to system delay; court order is $317/mo to Dawndee that now follows Kody to foster care; Ewing AFFIRMATIVELY SUGGESTS appellant request a "good cause exception" form requiring worker + supervisor + Circuit Manager to sign off (Riley \u2192 Emmons \u2192 Garrity); appellant requests receipts-credit for items he bought directly and asks whether his KS residence requires the review be filed there or in MO',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Child-support-case-51588021-Ewing.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-06-14', '2022-06-15', '2022-12-28', 'child-support', 'case-51588021', '317-per-month', 'good-cause-exception', 'shannon-ewing', 'rolla-mo', 'ks-residence'],
      },
      {
        title: 'letter-of-enrollment (1).pdf (11/30/2022, batch 1-2): appellant emails Riley a school enrollment letter for Kody (likely Marionville pre-K, per Emmons\u2019 4/2022 statement) \u2014 substantive engagement with child\u2019s schooling',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Letter-of-enrollment-1-2.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-11-30', 'letter-of-enrollment', 'school-engagement', 'shania-riley'],
      },
      {
        title: 'letter-of-enrollment (1).pdf (11/30/2022, batch 2): duplicate of school-enrollment letter submission to Riley',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Letter-of-enrollment-2.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-11-30', 'letter-of-enrollment', 'duplicate'],
      },
      // ---- Batch 13: Hassle Free hair-follicle, KS lab offer, Wolf Miller-took-prosecutor admission, Spellman Robertson formal naming, court-appointed-attorney application offer, Zoom-visit setup ----
      {
        title: 'RE: Monthly Check In (1/26\u20131/31/2023, batch 5): Riley confirms court-ordered hair follicle arranged for 2/1/2023 at Hassle Free, 510 E 32nd St, Joplin MO 64804 (testing 8:30\u201311:30am & 1\u20134:30pm), NO COST to appellant. Earlier in the thread (1/26/2023), Riley asks if appellant was "ever able to get ahold of your court appointed attorney since Kathleen is no longer representing you" \u2014 contemporaneous DSS confirmation that Kathleen Wolf Miller WAS no longer counsel and appellant could not reach the court-appointed replacement',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Monthly-Check-In-5-Hassle-Free-hair-follicle.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2023-01-26', '2023-01-31', '2023-02-01', 'hair-follicle', 'hassle-free-joplin', '510-e-32nd-st', 'wolf-miller-withdrawn', 'court-appointed-counsel-unreachable', 'shania-riley'],
      },
      {
        title: 'RE: Monthly check in (11/23\u201312/28/2022, batch 6): KEY ADMISSION \u2014 appellant tells Riley "someone has told me she [Wolf Miller] took a prosecutor position in Lawrence County\u2026 please let me know"; appellant asks if Riley can arrange drug testing in KANSAS (close to home) \u2014 cites financial burden of multi-weekly MO trips, child support, food, clothing, winter coats he bought; offers Spring River Mental Health (KS) as testing venue. Riley responds appellant may pay out-of-pocket for KS lab or use MO at no cost; Riley confirms she docketed appellant\u2019s letter and certificate (parenting course completion) to the court',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Monthly-Check-In-6-Wolf-Miller-prosecutor.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-11-23', '2022-11-25', '2022-12-28', 'wolf-miller-prosecutor-lawrence-county', 'parenting-course-completion', 'spring-river-ks', 'financial-burden', 'docketed-by-riley'],
      },
      {
        title: 'RE: Re: Drug Alcohol Evaluation (6/27\u20137/21/2022, primary): Riley confirms in writing that the ONLY copy of the appellant\u2019s drug/alcohol evaluation she has received is the pictures appellant emailed her \u2014 Spring River failed to send DSS the records through normal channels; chain shows Riley\u2019s 6/27/2022 offer to meet at church to pick up paper copy and appellant\u2019s repeated follow-ups',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Re-Re-Drug-Alcohol-Evaluation.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-06-27', '2022-07-08', '2022-07-21', 'spring-river-no-records', 'pictures-only-copy', 'shania-riley', 'hand-delivery-offer'],
      },
      {
        title: 'RE: Re: Drug Alcohol Evaluation (batch 1, duplicate): same Spring-River-pictures-only-copy chain \u2014 second saved copy',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Re-Re-Drug-Alcohol-Evaluation-1.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-07-21', 'spring-river-no-records', 'duplicate'],
      },
      {
        title: 'RE: Visitation, work, attorney (2/16\u20132/21/2023, batch 7): KEY ADMISSION \u2014 Emmons cc\u2019s Garrity and Riley and writes appellant: "if you are still working with a private attorney, you are still welcome to complete an application for the court to appoint you an attorney to represent you in the adoption proceedings and termination of parental rights" \u2014 offers attached application; Emmons further states "Shania and I talked about ways we could work\u2026 to keep the boys in a setting where they can sit and talk" re: Zoom visits with placement \u2014 first formal DSS endorsement of Zoom visitation. Riley then names "Spellman Robertson" with phone 913-486-9247 \u2014 formal naming of appellant\u2019s court-appointed counsel by DSS in writing',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Visitation-work-attorney-7-Spellman-Robertson.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2023-02-16', '2023-02-21', 'spellman-robertson', 'attorney-913-486-9247', 'court-appointed-counsel-application', 'zoom-visits', 'social-study-response', 'jennifer-emmons', 'brian-garrity', 'shania-riley'],
      },
      {
        title: 'RE: Visitation, work, attorney (batch 8, duplicate): same 2/21/2023 chain naming Spellman Robertson and offering court-appointed-attorney application \u2014 second saved copy',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Visitation-work-attorney-8.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2023-02-21', 'spellman-robertson', 'duplicate'],
      },
      {
        title: 'No subject (5/7/2022, batch 7-9): forwarded chain to Riley/Emmons of grievance-to-Garrity submission of the DEED (Goodman Remodel & Rentals residence) \u2014 second duplicate copy of deed-evidence multi-recipient routing',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/no-subject-7-9-Deed-grievance-fwd.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2022-05-07', 'deed', 'housing-evidence', 'goodman-remodel-rentals', 'duplicate'],
      },
      {
        title: 'No subject (5/12/2023, batch 8-4): on appellant\u2019s active IRS audit \u2014 appellant tells Riley he can\u2019t release all financial info but his oldest daughter is a CPA and can submit an affidavit as his business accountant if Riley or Emmons would like; also volunteers Rustoration (his metal-restoration business with patent-pending rust process) as employment evidence \u2014 evidence of ongoing business operations and financial-disclosure compliance effort',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/no-subject-8-4-CPA-daughter-affidavit.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2023-05-12', 'irs-audit', 'cpa-daughter-affidavit', 'rustoration', 'metal-restoration-business', 'patent-pending', 'employment-evidence', 'shania-riley'],
      },
      {
        title: 'No subject (5/12/2023, batch 9-3): companion to CPA-daughter email \u2014 short follow-up to Riley same day',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/no-subject-9-3.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2023-05-12', 'follow-up', 'shania-riley'],
      },
      // ---- Batch 14: Proof of Income / 2022 Tax Return (the very return Riley confirmed docketed on 6/12/2023) ----
      {
        title: 'Proof of income (4/27/2023): appellant emails Riley his 2022 Tax Return (2022-TaxReturn.pdf attached) two months before TPR trial \u2014 this is the same tax return Riley confirmed in writing on 6/12/2023 that she had docketed to the court (see "Contact" 6/12/2023 exhibit); evidence of timely, voluntary financial disclosure',
        category: 'evidence' as const,
        module: require('@assets/seed-case-sd38180/emails/Proof-of-income-3-2022-tax-return.eml'),
        mimeType: 'message/rfc822',
        tags: ['email', 'evidence', '2023-04-27', 'proof-of-income', '2022-tax-return', 'pre-trial-disclosure', 'docketed-by-riley', 'shania-riley'],
      },
      // ---- Full TPR Hearing Transcript (June 27, 2023) ----
      {
        title: 'TPR Hearing Transcript — In re K.C.G. (No. 22AO-JU00288) & T.R.A. (No. 22AO-JU00287), Judge Vorhees, Holliday Reporting (131 pp., taken 6/27/2023, printed 9/23/2023)',
        category: 'transcript' as const,
        module: require('../../../assets/seed-case-sd38180/transcripts/Transcript-TPR-Hearing-Kody-2023-06-27.pdf'),
        mimeType: 'application/pdf',
        tags: ['transcript', 'tpr-hearing', 'judge-vorhees', '22AO-JU00288', '22AO-JU00287', '2023-06-27', 'holliday-reporting', 'spellman-robertson', 'lindsey-drake', 'tricia-gould', 'lauren-rowden', 'belinda-kaderly'],
      },
    ];
    for (const b of bundled) {
      try {
        const asset = Asset.fromModule(b.module);
        await asset.downloadAsync();
        const uri = asset.localUri ?? asset.uri;
        await deps.documents.uploadDocument({
          caseId: created.id,
          ownerUserId: user.id,
          title: b.title,
          category: b.category,
          fileUri: uri,
          mimeType: b.mimeType,
          tags: b.tags,
        });
      } catch (err) {
        console.warn('[seed] could not upload bundled doc', b.title, err);
      }
    }
  } catch (err) {
    console.warn('[seed] document seeding failed', err);
  }

  // 5) Pre-populated issue flags based on the case narrative.
  //    NOTE: phrased as "possible ... to review" \u2014 NEVER as legal conclusions.
  const flags = SD38180_FLAGS;
  for (const f of flags) {
    await deps.issues.createIssueFlag({
      caseId: created.id,
      type: f.type,
      severity: f.severity,
      summary: f.summary,
      explanation: f.explanation,
      sourceRefs: f.sourceRefs,
      status: 'system_generated',
    });
  }

  return true;
}

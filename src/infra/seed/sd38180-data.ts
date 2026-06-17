// Pure-data module: SD38180 timeline events + issue flags.
// No React Native imports — safe to import from Node scripts (export generation,
// CI checks, server functions) as well as from the on-device seed module.

import type { EventType, IssueType, IssueSeverity } from '@domain/entities';

export interface SeedEvent {
  at: string;
  type: EventType;
  desc: string;
  tags?: string[];
}

export interface SeedFlag {
  type: IssueType;
  severity: IssueSeverity;
  summary: string;
  explanation: string;
  sourceRefs: string[];
}

export const SD38180_EVENTS: SeedEvent[] = [
    { at: '2018-10-13', type: 'other', desc: 'K.C.G. born.' },
    {
      at: '2019-09-04',
      type: 'other',
      desc: 'Judgment of Paternity and Order of Custody issued by Judge Angela Vorhees \u2014 same judge who later presided over TPR trial. Decree granted M.G. 50/50 physical and legal custody (extended visits scheduled to begin once K.C.G. turned 3).',
      tags: ['paternity', 'custody', 'judge:Vorhees'],
    },
    {
      at: '2021-01-02',
      type: 'report',
      desc: 'K.C.G. taken to emergency room in Carthage, MO; tested positive for an illegal substance while in mother\u2019s custody.',
      tags: ['removal-trigger', 'mother-custody'],
    },
    {
      at: '2021-01-02',
      type: 'removal',
      desc: 'K.C.G. removed from mother\u2019s custody. At the time, father had Wednesday visits + every-other-weekend in Kansas; the removal occurred outside father\u2019s visitation window.',
      tags: ['removal', 'father-not-on-duty'],
    },
    {
      at: '2021-01-04',
      type: 'shelter_hearing',
      desc: 'Emergency shelter hearing held WITHOUT father being appointed counsel.',
      tags: ['no-counsel', 'shelter-hearing'],
    },
    {
      at: '2021-02-09',
      type: 'adjudication',
      desc: 'Adjudication hearing \u2014 father appeared with NO counsel. Notice received only at the prior hearing.',
      tags: ['no-counsel', 'late-notice'],
    },
    {
      at: '2021-02-23',
      type: 'meeting',
      desc: 'Father filed pro se: (a) Motion for Rehearing (re: meaningful contact), (b) Motion to Proceed as a Poor Person, (c) Motion for Family Access in Circuit Court of Jasper County, (d) Motion to Modify Custody in Family Court.',
      tags: ['pro-se-filing'],
    },
    {
      at: '2021-02-23',
      type: 'review_hearing',
      desc: 'Court denied 2/23 motions; found M.G. had sufficient funds (contested). Motion to Modify Custody STAYED pending juvenile jurisdiction. Ron Sparling appointed without father\u2019s knowledge (only discovered 6/6/2022 when case files first requested).',
      tags: ['counsel-appointed-without-knowledge', 'judge:Vorhees'],
    },
    {
      at: '2021-03-09',
      type: 'meeting',
      desc: 'Kathleen Wolf Miller filed Entry of Appearance pro bono.',
      tags: ['attorney:Miller'],
    },
    {
      at: '2021-03-15',
      type: 'other',
      desc: 'Court mailed notice to wrong address: "8681 SE 71ST ST Carthage MO 64836" \u2014 a non-existent address (correct address is in Baxter Springs, KS).',
      tags: ['address-defect', 'notice-defect'],
    },
    {
      at: '2022-02-17',
      type: 'review_hearing',
      desc: 'First and only hearing scheduled in person with counsel \u2014 RESCHEDULED. Counsel did not appear.',
      tags: ['counsel-no-show'],
    },
    {
      at: '2022-03-10',
      type: 'review_hearing',
      desc: 'Reset hearing \u2014 counsel did not appear again.',
      tags: ['counsel-no-show'],
    },
    {
      at: '2022-03-31',
      type: 'review_hearing',
      desc: 'Judge Vorhees stated on the record that if Kathleen Wolf Miller did not appear next time she would be held in contempt and proceedings would go forward with or without her.',
      tags: ['counsel-no-show', 'on-the-record'],
    },
    {
      at: '2022-04-07',
      type: 'permanency_hearing',
      desc: 'Motion to modify goal from reunification to adoption (requested by juvenile division) held \u2014 3 hearings after the original 2/17/2022 setting where counsel failed to appear each time.',
      tags: ['goal-change', 'reunification-to-adoption'],
    },
    {
      at: '2021-12-07',
      type: 'other',
      desc: 'Email from J. Emmons (DSS Supervisor) to appellant — "Checking In": reminder of 11am meeting next day. Supervisor explicitly states: "I still have not heard anything from your attorney." Contemporaneous DSS-side confirmation that appointed/pro-bono counsel was not communicating with the agency 9+ months into the case.',
      tags: ['email', 'dss', 'counsel-non-communication', 'jennifer-emmons'],
    },
    {
      at: '2022-04-12',
      type: 'other',
      desc: 'Email from J. Emmons to K. Wolf Miller AND appellant scheduling the routine 6-month case review for 6/6/2022 at 1:00pm, 601 Commercial St., Joplin — establishes that DSS was simultaneously sending notices to Wolf Miller while she was failing to appear at court hearings (2/17, 3/10, 3/31 no-shows).',
      tags: ['email', 'dss', 'wolf-miller', 'meeting-notice'],
    },
    {
      at: '2022-05-04',
      type: 'other',
      desc: 'Email from B. Garrity (Circuit Manager, 29th Circuit, DSS Children’s Division) to appellant requesting phone callback at 417-629-3211 — part of grievance process.',
      tags: ['email', 'dss', 'grievance', 'brian-garrity'],
    },
    {
      at: '2022-05-07',
      type: 'other',
      desc: 'Appellant forwarded to Emmons + Riley his grievance correspondence with B. Garrity attaching the 2021 negative drug test results: "Drug test taken in 2021 at beginning of case copy of results (negative)." Contemporaneous documentary contradiction of any chemical-dependency framing as to the father.',
      tags: ['email', 'evidence', 'drug-tests-negative', 'grievance'],
    },
    {
      at: '2022-07-21',
      type: 'other',
      desc: 'Email from S. Riley to appellant: "I received a fax from spring river and it stated you did not meet criteria for a mental health disorder. I received the pictures you also sent me and I will docket those with the court." — DSS-side written confirmation that appellant did not meet criteria for a mental-health disorder and that exculpatory pictures would be docketed with the court.',
      tags: ['email', 'evidence', 'mental-health-cleared', 'spring-river', 'shania-riley'],
    },
    {
      at: '2022-07-26',
      type: 'other',
      desc: 'Email thread Riley ↔ Goodman — appellant formally requests address correction: "The address on the case file says 8681 SE 71st Carthage Mo. Which is incorrect and because of this I was not properly served the correct address at the beginning of the case to present is 8681 SE 71st Baxter Springs KS. I was unable to point this error out earlier because I was unable to get a copy of the case file." DSS Specialist Riley acknowledged she would "forward your correct one on." First contemporaneous documentary acknowledgement by DSS that the case file had the wrong address.',
      tags: ['email', 'evidence', 'wrong-address', 'service-defect', 'shania-riley'],
    },
    {
      at: '2022-06-06',
      type: 'other',
      desc: 'Father first requested court files \u2014 only then learned Ron Sparling had been appointed back in Feb 2021.',
      tags: ['records-request'],
    },
    {
      at: '2022-10-26',
      type: 'other',
      desc: 'Spellman Robertson appointed as counsel. Several pre-trial contact attempts (in person to clerk) went unanswered. Father met with Mr. Robertson for the first time the single day before trial.',
      tags: ['counsel-appointed', 'inadequate-consultation'],
    },
    {
      at: '2023-01-01',
      type: 'tpr_trial',
      desc: 'TPR trial conducted by Judge Vorhees.',
      tags: ['tpr-trial', 'judge:Vorhees'],
    },
    {
      at: '2023-06-01',
      type: 'tpr_judgment',
      desc: 'Judgment terminating parental rights entered (lower court case 22AO-JU00288).',
      tags: ['tpr-judgment'],
    },
    {
      at: '2024-04-20',
      type: 'appeal',
      desc: 'Pro se MOTION FOR RECONSIDERATION, REQUEST FOR EN BANC REVIEW TRANSFER, AND PETITION FOR INJUNCTIVE RELIEF FOR ONGOING VIOLATION OF FEDERAL RIGHTS UNDER 42 U.S.C. \u00a7 1983 AND THE EX PARTE YOUNG DOCTRINE filed in Missouri Court of Appeals Southern District (SD38180).',
      tags: ['appeal', 'pro-se', '1983'],
    },
    {
      at: '2024-05-02',
      type: 'appeal',
      desc: 'ORDER: Missouri Court of Appeals Southern District construed the 4/20/2024 filing as a motion for rehearing and application for transfer (Mo. Sup. Ct. Rules 83.02, 84.17(a)(1)). DENIED in its entirety per Rule 83.04. All other unruled-on requests for relief also denied.',
      tags: ['order-denying', 'rule-83.04'],
    },
    {
      at: '2024-05-17',
      type: 'appeal',
      desc: 'Pro se NOTICE under Rule 83.04 of Application for Transfer to be filed in Missouri Supreme Court emailed to sdcoa@courts.mo.gov. Appellant noted not having received the full 15-day notice because prior emails went unanswered and Court of Appeals decision was first learned of by mail.',
      tags: ['supreme-court-transfer', 'notice-issue'],
    },
    // ===========================================================================
    // Email-derived structured findings (added in enrichment pass)
    // Each entry mirrors a specific exhibit already wired into the `bundled` array
    // and is phrased as an evidentiary fact, not a legal conclusion.
    // ===========================================================================
    {
      at: '2021-06-30',
      type: 'other',
      desc: 'Appellant initiated BeenVerified records search on J. Emmons (DSS Supervisor) — contemporaneous record of appellant investigating the assigned supervisor early in the case.',
      tags: ['email', 'beenverified', 'jennifer-emmons'],
    },
    {
      at: '2021-08-25',
      type: 'meeting',
      desc: 'Webex / Family Support Team (FST) meeting — Emmons facilitates. Documents establish that NO signed Written Service Agreement / voluntary case plan was ever executed. Emmons admission on this thread: "we no longer do the Written Service Agreements." Possible procedural defect re: 13 CSR 35-60.030 service-agreement requirement.',
      tags: ['email', 'dss', 'fst-meeting', 'no-signed-service-agreement', 'jennifer-emmons', '2021-08-25'],
    },
    {
      at: '2021-09-09',
      type: 'other',
      desc: 'Email thread "Following Up" (J. Emmons ↔ appellant) — Emmons attempts contact re: post-FST follow-through. Establishes pattern that DSS-side outreach to appellant was via personal Gmail (not via Wolf Miller, who was attorney of record).',
      tags: ['email', 'dss', 'counsel-bypass', 'jennifer-emmons', '2021-09-09'],
    },
    {
      at: '2022-03-08',
      type: 'review_hearing',
      desc: 'Court continuance: 3/8/2022 hearing reset to 3/31/2022. Emmons emailed appellant + K. Wolf Miller of reset. Appellant later forwarded this thread to ACLU-MO on 3/16/2022 — contemporaneous third-party-witness record of the counsel-no-show pattern.',
      tags: ['continuance', 'aclu-mo-witness', 'wolf-miller', '2022-03-08'],
    },
    {
      at: '2022-04-04',
      type: 'other',
      desc: 'Email thread "RE: parents" (J. Emmons → appellant, 4/4–4/5/2022) — Emmons invokes AFSA / ASFA 15-of-22-month timeline as basis for moving away from reunification; tells appellant Kody will begin Pre-K in Marionville in fall. Appellant raises lack of contract, lack of voluntary case plan, lack of trial, and insufficient counsel.',
      tags: ['email', 'dss', 'asfa-15-of-22', 'goal-change-signal', 'jennifer-emmons', '2022-04-04'],
    },
    {
      at: '2022-04-18',
      type: 'other',
      desc: 'Caseworker transfer: Emmons emails appellant + Wolf Miller announcing the case is reassigned from Emmons (Supervisor) to Shania Riley (Specialist). Establishes the Emmons→Riley handoff that recurs throughout the 2022 record.',
      tags: ['email', 'dss', 'caseworker-transfer', 'jennifer-emmons', 'shania-riley', '2022-04-18'],
    },
    {
      at: '2022-05-07',
      type: 'other',
      desc: 'Bounce: appellant\'s attempt to send "Documents requested to be submitted to judge by Jennifer Emmons" failed at the SMTP layer (Mail Delivery Subsystem — message too large). Contemporaneous record that appellant attempted to route documentary evidence to DSS for judicial submission but was blocked by mail-server limits.',
      tags: ['email', 'evidence', 'bounce', 'documents-to-judge', '2022-05-07'],
    },
    {
      at: '2022-05-24',
      type: 'other',
      desc: 'NXDOMAIN bounces: appellant\'s attempts to reach the juvenile officer / court process via complaint.juvenile.officer@courts.mo.gov and multiple smpsa0002.courts.state.mo.us addresses failed with DNS "no such domain" responses. Contemporaneous record that official court-process email channels were not reachable from outside.',
      tags: ['email', 'evidence', 'nxdomain', 'court-process-access', '2022-05-24'],
    },
    {
      at: '2022-05-25',
      type: 'visit',
      desc: 'Missed-visit pattern: appellant\'s record reflects scheduled visits that did not occur on/around 5/25/2022. Whether transportation, scheduling, and cross-border (KS↔MO) logistics were "available, affordable, and reachable" is a reasonable-efforts question.',
      tags: ['visit', 'reasonable-efforts', 'cross-border', '2022-05-25'],
    },
    {
      at: '2022-05-31',
      type: 'other',
      desc: 'Email thread "Information request" (appellant ↔ Emmons, 5/31/2022) — appellant disputes adequacy of background check vs. statutory MULES requirement and requests grievance form. ICPC-blocked admission embedded: "team was not in agreement to move forward with ICPC" due to pending drug charges — DSS-side written acknowledgement that ICPC was held up by pending (not yet adjudicated) charges.',
      tags: ['email', 'evidence', 'mules', 'icpc-blocked', 'pending-charges', 'jennifer-emmons', '2022-05-31'],
    },
    {
      at: '2022-06-23',
      type: 'other',
      desc: 'Spring River records-failure pattern: Riley reported (in this and adjacent threads) that Spring River fax was non-responsive — "no records for you." Appellant\'s mental-health evaluation records could not be retrieved through DSS\'s normal fax channel.',
      tags: ['evidence', 'spring-river', 'records-failure', 'shania-riley', '2022-06-23'],
    },
    {
      at: '2022-09-20',
      type: 'other',
      desc: 'Email from S. Riley confirms appellant\'s correct address "8681 SE 71ST ST BAXTER SPRINGS, KS 66713–4105" — DSS-side written acknowledgement of the KS address (contradicting the "Carthage MO" address used in earlier court mailings). Same email schedules hair-follicle test 9/21/2022 and notes paper court review set for 11/10.',
      tags: ['email', 'evidence', 'address-confirmed-ks', 'hair-follicle', 'paper-review', '2022-09-20'],
    },
    {
      at: '2023-02-01',
      type: 'drug_test',
      desc: 'Hassle Free Testing — court-ordered hair-follicle test arranged by Riley at NO cost to appellant. Establishes that when DSS chose to make a test "available, affordable, and reachable," it was — relevant to reasonable-efforts analysis for the earlier missed-test allegations.',
      tags: ['drug-test', 'hair-follicle', 'hassle-free', 'shania-riley', '2023-02-01'],
    },
    {
      at: '2023-02-16',
      type: 'other',
      desc: 'Riley provides appellant with a phone number (913-486-9247) for appellant\'s own attorney — DSS-side written acknowledgement that appellant did not have working contact information for his own counsel, and that DSS was acting as intermediary.',
      tags: ['email', 'counsel-unreachable', 'dss-as-intermediary', 'shania-riley', '2023-02-16'],
    },
    {
      at: '2023-02-21',
      type: 'other',
      desc: 'Emmons emails appellant: (a) formally names Spellman Robertson as counsel and (b) offers appellant a "court-appointed attorney application" — while private/appointed counsel (Robertson) already existed. Possible procedural anomaly worth attorney review re: parallel counsel pathways.',
      tags: ['email', 'dss', 'court-appointed-attorney-application', 'spellman-robertson', 'jennifer-emmons', '2023-02-21'],
    },
    {
      at: '2023-04-27',
      type: 'other',
      desc: 'Appellant submits proof-of-income / 2022 federal tax return to DSS as evidence of stable employment and ability to provide for child. Establishes contemporaneous documentary record of appellant\'s financial fitness during pendency.',
      tags: ['email', 'evidence', 'proof-of-income', '2022-tax-return', '2023-04-27'],
    },
    {
      at: '2023-06-09',
      type: 'other',
      desc: 'Formal notice to DSS of intended 42 U.S.C. § 1983 civil-rights suit embedded in "Re: abuse of discretion re: K.G." thread — pre-litigation notice contemporaneously preserved in DSS correspondence.',
      tags: ['email', 'evidence', '1983-notice', 'pre-litigation', '2023-06-09'],
    },
    {
      at: '2023-06-12',
      type: 'other',
      desc: 'Riley docketing confirmation: DSS-side written acknowledgement that documents submitted by appellant (including the 4/27/2023 proof-of-income) were docketed with the court. Establishes a chain-of-custody record for documentary evidence routed through DSS.',
      tags: ['email', 'evidence', 'docketing', 'shania-riley', '2023-06-12'],
    },
];

export const SD38180_FLAGS: SeedFlag[] = [
    {
      type: 'counsel',
      severity: 'serious',
      summary: 'Possible right-to-counsel concern \u2014 multiple early hearings without appointed counsel',
      explanation:
        'Records reflect emergency shelter hearing (1/4/2021), adjudication hearing (2/9/2021), and the 2/23/2021 hearing all occurred without father being represented. Lassiter v. Department of Social Services and Missouri\u2019s statutory right to counsel in TPR-track matters make this worth attorney review.',
      sourceRefs: ['event:2021-01-04', 'event:2021-02-09', 'event:2021-02-23'],
    },
    {
      type: 'counsel',
      severity: 'serious',
      summary: 'Possible covert-appointment-of-counsel concern (Ron Sparling, 2/23/2021)',
      explanation:
        'Notice reflects Ron Sparling was appointed on 2/23/2021 without appellant\u2019s knowledge \u2014 discovered only when court files were requested on 6/6/2022. Whether undisclosed appointment satisfied effective-representation requirements is worth attorney review.',
      sourceRefs: ['event:2021-02-23', 'event:2022-06-06'],
    },
    {
      type: 'counsel',
      severity: 'serious',
      summary: 'Possible inadequate-consultation concern (Spellman Robertson, day-before-trial meeting)',
      explanation:
        'Counsel appointed 10/26/2022; first meeting occurred only the single day before trial despite multiple in-person clerk-office attempts to make contact. Strickland v. Washington framework and dependency-counsel adequacy cases support attorney review of whether assistance was meaningful.',
      sourceRefs: ['event:2022-10-26'],
    },
    {
      type: 'counsel',
      severity: 'watch',
      summary: 'Possible conflict-of-interest concern (K. Wolf Miller pro bono \u2192 prosecutorial role)',
      explanation:
        'Appellant uncertain when Kathleen Wolf Miller withdrew, then later took a prosecutorial role. The sequence raises a conflict-of-interest question worth attorney review.',
      sourceRefs: ['event:2021-03-09', 'event:2022-03-31'],
    },
    {
      type: 'notice',
      severity: 'serious',
      summary: 'Possible address/service defect \u2014 notice mailed to non-existent address',
      explanation:
        'Letter from Mellisa Holcomb was mailed to "8681 SE 71ST ST Carthage MO 64836" \u2014 a non-existent address. Father\u2019s actual address is Baxter Springs, KS. Improper service is a recognized procedural concern worth attorney review.',
      sourceRefs: ['event:2021-03-15'],
    },
    {
      type: 'notice',
      severity: 'watch',
      summary: 'Possible 15-day-notice concern at appellate level',
      explanation:
        'In the 5/17/2024 Rule 83.04 notice, appellant stated he was not afforded the full 15-day window because prior emails to the Court of Appeals received no response and the denial order was only learned of by mail. Worth attorney review for timing of transfer to Mo. Sup. Ct.',
      sourceRefs: ['event:2024-05-17'],
    },
    {
      type: 'hearing_delay',
      severity: 'serious',
      summary: 'Possible repeated-counsel-no-show concern (Feb \u2013 Apr 2022)',
      explanation:
        'Hearings on 2/17/2022, 3/10/2022, and 3/31/2022 reset because counsel failed to appear. By 4/7/2022 the goal-change motion (reunification \u2192 adoption) was heard. Counsel non-appearance at material hearings is worth attorney review.',
      sourceRefs: ['event:2022-02-17', 'event:2022-03-10', 'event:2022-03-31', 'event:2022-04-07'],
    },
    {
      type: 'reasonable_efforts',
      severity: 'watch',
      summary: 'Possible reasonable-efforts concern \u2014 father living out of state',
      explanation:
        'Father resided in Baxter Springs, KS while case was in Jasper County, MO. Whether services and visitation were "available, affordable, and reachable" given the cross-border circumstances is worth attorney review.',
      sourceRefs: ['event:2018-10-13'],
    },
    {
      type: 'chemical_dependency',
      severity: 'watch',
      summary: 'Substance-use allegation: completion of treatment vs. trial findings',
      explanation:
        'Appellant asserts completion of substance abuse treatment under The Peoples Network with post-treatment evaluations contradicting earlier assumptions. Comparison of trial-court chemical-dependency findings against treatment documentation is worth attorney review.',
      sourceRefs: ['event:2023-01-01'],
    },
    {
      type: 'evidence_quality',
      severity: 'watch',
      summary: 'Possible same-judge-throughout concern (Judge Vorhees, 2019 paternity \u2192 2023 TPR)',
      explanation:
        'Judge Angela Vorhees presided over both the 2019 paternity/custody decree granting father 50/50 custody and the later TPR trial. Whether continuous-jurisdiction here affected impartiality of findings is worth attorney review.',
      sourceRefs: ['event:2019-09-04', 'event:2023-01-01'],
    },
    {
      type: 'placement',
      severity: 'info',
      summary: 'Possible placement-with-fit-parent concern',
      explanation:
        'At the time of removal, the child was not in father\u2019s care \u2014 but father held 50/50 legal/physical custody under the 2019 decree. Whether placement with the non-offending fit parent was properly considered is worth attorney review.',
      sourceRefs: ['event:2019-09-04', 'event:2021-01-02'],
    },
    // -----------------------------------------------------------------------
    // Email-derived flags (enrichment pass). All phrased as "possible … to review".
    // -----------------------------------------------------------------------
    {
      type: 'counsel',
      severity: 'serious',
      summary: 'Possible counsel-non-communication pattern (Wolf Miller, 12/2021 → 3/2022)',
      explanation:
        'On 12/7/2021 the DSS supervisor stated in writing to appellant: "I still have not heard anything from your attorney." Counsel then failed to appear at three consecutive hearings (2/17, 3/10, 3/31/2022). The DSS supervisor and the trial court independently documented the same non-communication during the same window. Worth attorney review.',
      sourceRefs: ['event:2021-12-07', 'event:2022-02-17', 'event:2022-03-10', 'event:2022-03-31'],
    },
    {
      type: 'service_access',
      severity: 'serious',
      summary: 'Possible ICPC-blocked-by-pending-charges concern (Emmons 5/31/2022 admission)',
      explanation:
        'In the 5/31/2022 "Information request" thread, Supervisor Emmons stated in writing that "team was not in agreement to move forward with ICPC" because of pending (not adjudicated) drug charges. Whether ICPC home-study can be withheld on pending-charges alone — particularly where appellant resided out of state with 50/50 legal custody — is worth attorney review.',
      sourceRefs: ['event:2022-05-31', 'event:2019-09-04'],
    },
    {
      type: 'counsel',
      severity: 'serious',
      summary: 'Possible no-signed-Written-Service-Agreement concern (Emmons 8/25/2021 admission)',
      explanation:
        'In the 8/25/2021 FST thread, Supervisor Emmons stated in writing that "we no longer do the Written Service Agreements." Missouri rule 13 CSR 35-60.030 historically required a signed voluntary service agreement before the formal case-plan path; whether the absence of one across the entire pendency is a procedural defect is worth attorney review.',
      sourceRefs: ['event:2021-08-25'],
    },
    {
      type: 'evidence_quality',
      severity: 'serious',
      summary: 'Possible Spring-River-records-failure concern (Riley, summer 2022)',
      explanation:
        'Specialist Riley reported in writing that the Spring River fax channel was non-responsive — she could not retrieve appellant\'s mental-health evaluation records ("no records for you"). Appellant\'s exculpatory records existed but were not pulled into the case file through normal channels. Worth attorney review for completeness of the evidentiary record at trial.',
      sourceRefs: ['event:2022-06-23', 'event:2022-07-21'],
    },
    {
      type: 'service_access',
      severity: 'watch',
      summary: 'Possible court-process-access concern (NXDOMAIN bounces, 5/24/2022)',
      explanation:
        'Appellant\'s emails to complaint.juvenile.officer@courts.mo.gov and multiple smpsa0002.courts.state.mo.us addresses bounced with DNS "no such domain" errors. Whether listed court-process email channels were actually reachable by parties without counsel is worth attorney review.',
      sourceRefs: ['event:2022-05-24'],
    },
    {
      type: 'reasonable_efforts',
      severity: 'serious',
      summary: 'Possible AFSA / ASFA 15-of-22-month invocation concern (Emmons 4/4/2022)',
      explanation:
        'In the 4/4/2022 "RE: parents" thread, Supervisor Emmons invoked the AFSA / ASFA 15-of-22-month timeline as basis for moving away from reunification — at a time when (per the record) no signed service agreement existed, ICPC was being blocked on pending charges, and counsel had failed to appear at three hearings. Whether the 15-of-22 clock should toll where reasonable efforts were arguably not in place is worth attorney review.',
      sourceRefs: ['event:2022-04-04', 'event:2022-05-31', 'event:2021-08-25', 'event:2022-03-31'],
    },
    {
      type: 'counsel',
      severity: 'serious',
      summary: 'Possible counsel-unreachable concern (DSS as intermediary, 2/16/2023)',
      explanation:
        'On 2/16/2023, Specialist Riley provided appellant with a phone number (913-486-9247) for appellant\'s own attorney — DSS-side written acknowledgement that the appellant did not have working contact information for his own counsel and that DSS was acting as intermediary between appellant and counsel. Worth attorney review.',
      sourceRefs: ['event:2023-02-16'],
    },
    {
      type: 'counsel',
      severity: 'watch',
      summary: 'Possible parallel-counsel-pathway concern (court-appointed attorney application offered 2/21/2023)',
      explanation:
        'On 2/21/2023, Supervisor Emmons (a) formally identified Spellman Robertson as appellant\'s counsel and (b) in the same correspondence offered appellant a "court-appointed attorney application." Whether DSS suggesting a parallel counsel pathway while appointed/private counsel already existed raises confusion or procedural defect is worth attorney review.',
      sourceRefs: ['event:2023-02-21', 'event:2022-10-26'],
    },
    {
      type: 'reasonable_efforts',
      severity: 'watch',
      summary: 'Possible disparate-availability concern (Hassle Free hair-follicle 2/1/2023, no cost)',
      explanation:
        'On 2/1/2023, Specialist Riley arranged a court-ordered hair-follicle test at Hassle Free Testing at no cost to appellant. Where DSS chose to make a service "available, affordable, and reachable," it was. Whether earlier missed-test allegations should be reweighed against this later proof-of-feasibility is worth attorney review.',
      sourceRefs: ['event:2023-02-01', 'event:2022-05-25'],
    },
    {
      type: 'evidence_quality',
      severity: 'watch',
      summary: 'Possible documentary-chain-of-custody concern (Riley docketing, 6/12/2023)',
      explanation:
        'Riley\'s 6/12/2023 confirmation that appellant\'s submitted documents (including 4/27/2023 proof-of-income / 2022 tax return) were docketed establishes that DSS controlled the chain of custody for documentary evidence that originated with appellant. Whether everything appellant submitted reached the trial record through this DSS-mediated channel is worth attorney review.',
      sourceRefs: ['event:2023-04-27', 'event:2023-06-12'],
    },
    {
      type: 'counsel',
      severity: 'watch',
      summary: 'Possible Wolf-Miller → prosecutor role-transition concern',
      explanation:
        'After withdrawing from appellant\'s representation, Kathleen Wolf Miller took a prosecutorial role in Lawrence County, MO. The sequence and any overlap in case knowledge / privileged information is worth attorney review for conflict-of-interest implications, separate from the earlier no-show pattern.',
      sourceRefs: ['event:2021-03-09', 'event:2022-04-12'],
    },
];

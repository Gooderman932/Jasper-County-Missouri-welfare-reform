// Guided rights review engine — pure functions, no I/O.
// Generates "possible issue to review" prompts. NEVER asserts legal conclusions.

import { CreateIssueFlagInput } from '../repositories';

export interface NoticeAnswers {
  servedWithPetition?: boolean;
  notificationMethod?: 'in_person' | 'mail' | 'phone' | 'email' | 'social' | 'unknown' | 'none';
  noticeIncludedHearingDateTime?: boolean;
  receivedFarEnoughInAdvance?: boolean;
  wrongOrOldAddressUsed?: boolean;
  hearingsHeldWithoutYouAfterContact?: boolean;
}

export interface DrugAllegationAnswers {
  substanceUseAlleged?: boolean;
  diagnosisOrIncapacityFinding?: boolean;
  documentedHarmToChild?: boolean;
  servicesOfferedAndAccessible?: boolean;
  testsTiedToParentingInability?: boolean;
}

export interface ReasonableEffortsAnswers {
  servicesOrdered?: string[];
  servicesAvailableAffordableReachable?: boolean;
  barriersDocumented?: boolean;
  missedServicesCitedAgainstYou?: boolean;
  reasonableEffortsRecitedWithoutSpecifics?: boolean;
}

export interface CounselAnswers {
  offeredCounsel?: boolean;
  appointedCounselTimely?: boolean;
  meaningfulConsultationBeforeHearings?: boolean;
}

export interface HearingTimingAnswers {
  hearingsHeldWithinStatutoryWindow?: boolean;
  delaysDocumented?: boolean;
  abilityToParticipateRemoteOrInPerson?: boolean;
}

export interface VisitationAnswers {
  visitationOrdered?: boolean;
  visitationActuallyFacilitated?: boolean;
  cancellationsLoggedAgainstParent?: boolean;
}

export interface EvidenceQualityAnswers {
  findingsSupportedBySpecificEvidence?: boolean;
  hearsayHeavilyRelied?: boolean;
  expertTestimonyChallenged?: boolean;
}

export interface ServiceAccessAnswers {
  transportationProvided?: boolean;
  affordable?: boolean;
  schedulingFlexible?: boolean;
}

export interface GuidedReviewAnswers {
  notice?: NoticeAnswers;
  drugAllegation?: DrugAllegationAnswers;
  reasonableEfforts?: ReasonableEffortsAnswers;
  counsel?: CounselAnswers;
  hearingTiming?: HearingTimingAnswers;
  visitation?: VisitationAnswers;
  evidenceQuality?: EvidenceQualityAnswers;
  serviceAccess?: ServiceAccessAnswers;
}

const reviewPhrase = (s: string) => s; // central place to keep "possible ... to review" tone consistent.

export function runGuidedReview(
  caseId: string,
  a: GuidedReviewAnswers
): CreateIssueFlagInput[] {
  const flags: CreateIssueFlagInput[] = [];

  // Notice module
  if (a.notice) {
    const n = a.notice;
    if (n.servedWithPetition === false) {
      flags.push({
        caseId,
        type: 'notice',
        severity: 'serious',
        summary: reviewPhrase('Possible notice or service defect to review'),
        explanation:
          'You indicated you were not served with a petition or court notice. Notice and service rules are a common procedural concern worth raising with a licensed attorney.',
        sourceRefs: ['module:notice:servedWithPetition=false'],
      });
    }
    if (n.noticeIncludedHearingDateTime === false) {
      flags.push({
        caseId,
        type: 'notice',
        severity: 'watch',
        summary: reviewPhrase('Possible defective notice contents to review'),
        explanation:
          'The notice you received may not have included a hearing date and time. An attorney can assess whether the notice was statutorily sufficient.',
        sourceRefs: ['module:notice:noticeIncludedHearingDateTime=false'],
      });
    }
    if (n.receivedFarEnoughInAdvance === false) {
      flags.push({
        caseId,
        type: 'notice',
        severity: 'watch',
        summary: reviewPhrase('Possible insufficient-time-to-prepare concern'),
        explanation:
          'You indicated notice did not arrive far enough in advance to attend. Timing-of-notice issues can sometimes affect due-process arguments.',
        sourceRefs: ['module:notice:receivedFarEnoughInAdvance=false'],
      });
    }
    if (n.wrongOrOldAddressUsed) {
      flags.push({
        caseId,
        type: 'notice',
        severity: 'serious',
        summary: reviewPhrase('Possible address or service-defect concern to review'),
        explanation:
          'You indicated notice was sent to an old or incorrect address. Improper service can be a significant procedural issue worth attorney review.',
        sourceRefs: ['module:notice:wrongOrOldAddressUsed=true'],
      });
    }
    if (n.hearingsHeldWithoutYouAfterContact) {
      flags.push({
        caseId,
        type: 'hearing_delay',
        severity: 'serious',
        summary: reviewPhrase('Possible hearing-participation concern to review'),
        explanation:
          'You reported hearings being held without you after providing updated contact information. This is the type of procedural issue an attorney may want to examine.',
        sourceRefs: ['module:notice:hearingsHeldWithoutYouAfterContact=true'],
      });
    }
  }

  // Drug allegation module
  if (a.drugAllegation) {
    const d = a.drugAllegation;
    if (d.substanceUseAlleged && d.diagnosisOrIncapacityFinding === false) {
      flags.push({
        caseId,
        type: 'chemical_dependency',
        severity: 'watch',
        summary: reviewPhrase('Substance-use allegation may need comparison against documented incapacity findings'),
        explanation:
          'Substance use was alleged but you did not see a diagnosis, dependency finding, or documented incapacity. In some jurisdictions including Missouri, statutory grounds distinguish between use and a finding of dependency or incapacity. Worth attorney review.',
        sourceRefs: ['module:drugAllegation:diagnosisOrIncapacityFinding=false'],
      });
    }
    if (d.substanceUseAlleged && d.documentedHarmToChild === false) {
      flags.push({
        caseId,
        type: 'chemical_dependency',
        severity: 'watch',
        summary: reviewPhrase('Possible mismatch between drug allegation and specific harm finding'),
        explanation:
          'You indicated no specific documented harm to the child tied to substance use. Whether harm or risk of harm is established is often a separate legal question worth attorney review.',
        sourceRefs: ['module:drugAllegation:documentedHarmToChild=false'],
      });
    }
    if (d.testsTiedToParentingInability === false) {
      flags.push({
        caseId,
        type: 'evidence_quality',
        severity: 'info',
        summary: reviewPhrase('Possible evidentiary weakness in linking tests to parenting inability'),
        explanation:
          'You reported that drug-test results were cited generally rather than tied to specific parenting inability. This linkage is often a contested point worth attorney review.',
        sourceRefs: ['module:drugAllegation:testsTiedToParentingInability=false'],
      });
    }
  }

  // Reasonable efforts module
  if (a.reasonableEfforts) {
    const r = a.reasonableEfforts;
    if (r.servicesAvailableAffordableReachable === false) {
      flags.push({
        caseId,
        type: 'reasonable_efforts',
        severity: 'serious',
        summary: reviewPhrase('Possible service-access barrier affecting compliance assessment'),
        explanation:
          'You reported ordered services were not realistically available, affordable, or reachable. Whether agency efforts were "reasonable" is a statutory question worth attorney review.',
        sourceRefs: ['module:reasonableEfforts:servicesAvailableAffordableReachable=false'],
      });
    }
    if (r.barriersDocumented === false) {
      flags.push({
        caseId,
        type: 'service_access',
        severity: 'watch',
        summary: reviewPhrase('Possible documentation gap regarding service barriers'),
        explanation:
          'You indicated barriers (transportation, scheduling, etc.) may not have been documented. Documentation gaps can affect later reasonable-efforts arguments.',
        sourceRefs: ['module:reasonableEfforts:barriersDocumented=false'],
      });
    }
    if (r.missedServicesCitedAgainstYou) {
      flags.push({
        caseId,
        type: 'reasonable_efforts',
        severity: 'watch',
        summary: reviewPhrase('Possible reasonable-efforts documentation concern'),
        explanation:
          'You reported missed services were later cited against you. Whether missed services were the parent\'s fault or stemmed from agency-side barriers is a question worth attorney review.',
        sourceRefs: ['module:reasonableEfforts:missedServicesCitedAgainstYou=true'],
      });
    }
    if (r.reasonableEffortsRecitedWithoutSpecifics) {
      flags.push({
        caseId,
        type: 'reasonable_efforts',
        severity: 'serious',
        summary: reviewPhrase('Possible boilerplate-findings concern to review'),
        explanation:
          'You reported the court recited "reasonable efforts" without specific examples. Boilerplate findings can sometimes be challenged; worth attorney review.',
        sourceRefs: ['module:reasonableEfforts:reasonableEffortsRecitedWithoutSpecifics=true'],
      });
    }
  }

  // Counsel module
  if (a.counsel) {
    const c = a.counsel;
    if (c.offeredCounsel === false) {
      flags.push({
        caseId,
        type: 'counsel',
        severity: 'serious',
        summary: reviewPhrase('Possible right-to-counsel concern to review'),
        explanation:
          'You indicated counsel was not offered. Parents in TPR proceedings often have statutory rights to counsel; this is worth attorney review.',
        sourceRefs: ['module:counsel:offeredCounsel=false'],
      });
    }
    if (c.appointedCounselTimely === false) {
      flags.push({
        caseId,
        type: 'counsel',
        severity: 'watch',
        summary: reviewPhrase('Possible delay-in-appointment-of-counsel concern'),
        explanation:
          'You indicated counsel was not appointed in a timely manner. Timing of appointment can affect representation quality and is worth attorney review.',
        sourceRefs: ['module:counsel:appointedCounselTimely=false'],
      });
    }
    if (c.meaningfulConsultationBeforeHearings === false) {
      flags.push({
        caseId,
        type: 'counsel',
        severity: 'watch',
        summary: reviewPhrase('Possible adequacy-of-consultation concern'),
        explanation:
          'You indicated you did not have meaningful consultation with counsel before hearings. Worth attorney review.',
        sourceRefs: ['module:counsel:meaningfulConsultationBeforeHearings=false'],
      });
    }
  }

  // Hearing timing module
  if (a.hearingTiming) {
    const h = a.hearingTiming;
    if (h.hearingsHeldWithinStatutoryWindow === false) {
      flags.push({
        caseId,
        type: 'hearing_delay',
        severity: 'serious',
        summary: reviewPhrase('Possible statutory-timeline concern to review'),
        explanation:
          'You indicated hearings may not have been held within statutory windows. Timeline compliance is often a procedural issue worth attorney review.',
        sourceRefs: ['module:hearingTiming:hearingsHeldWithinStatutoryWindow=false'],
      });
    }
    if (h.abilityToParticipateRemoteOrInPerson === false) {
      flags.push({
        caseId,
        type: 'hearing_delay',
        severity: 'watch',
        summary: reviewPhrase('Possible participation-access concern'),
        explanation:
          'You indicated you could not meaningfully participate (remote or in person). Access-to-hearing issues are sometimes raised on appeal.',
        sourceRefs: ['module:hearingTiming:abilityToParticipateRemoteOrInPerson=false'],
      });
    }
  }

  // Visitation
  if (a.visitation) {
    const v = a.visitation;
    if (v.visitationOrdered && v.visitationActuallyFacilitated === false) {
      flags.push({
        caseId,
        type: 'visitation',
        severity: 'serious',
        summary: reviewPhrase('Possible visitation-facilitation concern to review'),
        explanation:
          'Visitation was ordered but not facilitated. Failure to facilitate ordered visitation can affect later "lack of bond" findings.',
        sourceRefs: ['module:visitation:visitationActuallyFacilitated=false'],
      });
    }
    if (v.cancellationsLoggedAgainstParent) {
      flags.push({
        caseId,
        type: 'visitation',
        severity: 'watch',
        summary: reviewPhrase('Possible visitation-logging concern'),
        explanation:
          'You indicated cancellations were logged against you despite being agency-side. Worth attorney review.',
        sourceRefs: ['module:visitation:cancellationsLoggedAgainstParent=true'],
      });
    }
  }

  // Evidence quality
  if (a.evidenceQuality) {
    const e = a.evidenceQuality;
    if (e.findingsSupportedBySpecificEvidence === false) {
      flags.push({
        caseId,
        type: 'evidence_quality',
        severity: 'watch',
        summary: reviewPhrase('Possible insufficient-findings concern'),
        explanation:
          'You indicated findings were not supported by specific evidence in the record. Worth attorney review.',
        sourceRefs: ['module:evidenceQuality:findingsSupportedBySpecificEvidence=false'],
      });
    }
    if (e.hearsayHeavilyRelied) {
      flags.push({
        caseId,
        type: 'evidence_quality',
        severity: 'info',
        summary: reviewPhrase('Possible hearsay-reliance concern'),
        explanation:
          'You indicated heavy reliance on hearsay. Evidentiary rules vary by hearing type and jurisdiction; worth attorney review.',
        sourceRefs: ['module:evidenceQuality:hearsayHeavilyRelied=true'],
      });
    }
  }

  // Service access
  if (a.serviceAccess) {
    const s = a.serviceAccess;
    if (s.transportationProvided === false) {
      flags.push({
        caseId,
        type: 'service_access',
        severity: 'watch',
        summary: reviewPhrase('Possible transportation-access concern'),
        explanation:
          'You indicated transportation was not provided. Transportation access often interacts with reasonable-efforts findings.',
        sourceRefs: ['module:serviceAccess:transportationProvided=false'],
      });
    }
    if (s.affordable === false) {
      flags.push({
        caseId,
        type: 'service_access',
        severity: 'watch',
        summary: reviewPhrase('Possible affordability-of-services concern'),
        explanation:
          'You indicated services were not affordable. Worth attorney review in context.',
        sourceRefs: ['module:serviceAccess:affordable=false'],
      });
    }
  }

  return flags;
}

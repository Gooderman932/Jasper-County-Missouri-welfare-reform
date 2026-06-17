// Free tier vs premium gating. Premium is entitlement-driven; these are the free caps.

export const FREE_TIER_LIMITS = {
  maxActiveCases: 1,
  maxDocumentsPerCase: 10,
  maxEventsPerCase: 25,
  exportEnabled: false,
  patternMatchingEnabled: false,
  attorneyReviewEnabled: false,
  ocrEnabled: false,
  remindersEnabled: true,
  reviewModulesEnabled: ['notice', 'reasonable_efforts'] as const, // limited
} as const;

export const PREMIUM_TIER_FEATURES = {
  maxActiveCases: Infinity,
  maxDocumentsPerCase: Infinity,
  maxEventsPerCase: Infinity,
  exportEnabled: true,
  patternMatchingEnabled: true,
  attorneyReviewEnabled: true,
  ocrEnabled: true,
  remindersEnabled: true,
  reviewModulesEnabled: 'all' as const,
} as const;

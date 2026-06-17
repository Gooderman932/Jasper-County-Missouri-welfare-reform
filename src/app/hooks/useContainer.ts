// Dependency container — wires concrete infra adapters to domain interfaces.
// Swap any of these in tests or in a future backend migration.
//
// LOCAL-DEV MODE: when EXPO_PUBLIC_USE_MEMORY_REPOS === 'true' the container
// returns fully in-memory repos so the app boots without Appwrite. See
// src/infra/memory/index.ts.

import { useMemo } from 'react';
import { AuthRepositoryAppwrite } from '@infra/appwrite/repositories/AuthRepositoryAppwrite';
import { CaseRepositoryAppwrite } from '@infra/appwrite/repositories/CaseRepositoryAppwrite';
import { DocumentRepositoryAppwrite } from '@infra/appwrite/repositories/DocumentRepositoryAppwrite';
import { EventRepositoryAppwrite } from '@infra/appwrite/repositories/EventRepositoryAppwrite';
import { IssueReviewRepositoryAppwrite } from '@infra/appwrite/repositories/IssueReviewRepositoryAppwrite';
import { PatternRepositoryAppwrite } from '@infra/appwrite/repositories/PatternRepositoryAppwrite';
import { PartyRepositoryAppwrite } from '@infra/appwrite/repositories/PartyRepositoryAppwrite';
import { GooglePlayBillingRepository } from '@infra/billing/GooglePlayBillingRepository';
import { OcrRepositoryFunction } from '@infra/ocr/OcrRepositoryFunction';
import { ExportRepositoryLocalPdf } from '@infra/exports/ExportRepositoryLocalPdf';
import { NotificationRepositoryExpo } from '@infra/notifications/NotificationRepositoryExpo';
import { makeMemoryRepos } from '@infra/memory';
import { makeUseCases } from '@domain/usecases';

const USE_MEMORY = process.env.EXPO_PUBLIC_USE_MEMORY_REPOS === 'true';

export function useContainer() {
  return useMemo(() => {
    if (USE_MEMORY) {
      const repos = makeMemoryRepos();
      const usecases = makeUseCases({
        auth: repos.auth,
        cases: repos.cases,
        documents: repos.documents,
        events: repos.events,
        issues: repos.issues,
        patterns: repos.patterns,
        billing: repos.billing,
        ocr: repos.ocr,
        exports: repos.exports,
      });
      return { ...repos, usecases };
    }

    const auth = new AuthRepositoryAppwrite();
    const cases = new CaseRepositoryAppwrite();
    const parties = new PartyRepositoryAppwrite();
    const events = new EventRepositoryAppwrite();
    const documents = new DocumentRepositoryAppwrite();
    const issues = new IssueReviewRepositoryAppwrite();
    const patterns = new PatternRepositoryAppwrite();
    const billing = new GooglePlayBillingRepository();
    const ocr = new OcrRepositoryFunction();
    const exports = new ExportRepositoryLocalPdf();
    const notifications = new NotificationRepositoryExpo();
    const usecases = makeUseCases({
      auth,
      cases,
      documents,
      events,
      issues,
      patterns,
      billing,
      ocr,
      exports,
    });
    return {
      auth,
      cases,
      parties,
      events,
      documents,
      issues,
      patterns,
      billing,
      ocr,
      exports,
      notifications,
      usecases,
    };
  }, []);
}

export type Container = ReturnType<typeof useContainer>;

// Dependency container — wires concrete infra adapters to domain interfaces.
// Swap any of these in tests or in a future backend migration.

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
import { makeUseCases } from '@domain/usecases';

export function useContainer() {
  return useMemo(() => {
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

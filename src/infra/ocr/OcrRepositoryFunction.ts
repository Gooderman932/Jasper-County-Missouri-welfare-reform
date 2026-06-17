// OCR adapter — delegates to an Appwrite Function which calls Google Cloud Vision (or any provider).
// The function name and provider can be swapped without touching domain code.

import { functions } from '@infra/appwrite/client';
import { OcrRepository } from '@domain/repositories';

const OCR_FUNCTION_ID = 'ocr-process';

export class OcrRepositoryFunction implements OcrRepository {
  async extractText(fileUri: string, mimeType: string): Promise<{ text: string; confidence: number }> {
    try {
      const exec = await functions.createExecution(
        OCR_FUNCTION_ID,
        JSON.stringify({ fileUri, mimeType })
      );
      const payload = (exec as any).responseBody ?? (exec as any).response ?? '{}';
      const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
      return {
        text: parsed.text ?? '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      };
    } catch (err) {
      return { text: '', confidence: 0 };
    }
  }
}

/**
 * POST /api/compare route (Should-have, FR-9).
 *
 * Accepts two document texts (via JSON or multipart upload), aligns them
 * clause-by-clause using edit-distance similarity, and returns a structured
 * diff with per-clause status and explanation.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { loadConfig } from '../config';
import { unsupportedFileType, scannedPdf, extractedTextTooLarge, AppError } from '../errors';
import { sanitizeText, isMeaningful } from '../services/sanitize';
import { extractText } from '../services/extractText';
import { alignAndDiff } from '../services/alignDiff';
import { isCompareRequest } from '../../shared/dto/validators';

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function createCompareRouter(overrides?: { config?: ReturnType<typeof loadConfig> }) {
  const config = overrides?.config ?? loadConfig();
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadBytes * 2 },
  });

  router.post(
    '/',
    upload.array('documents', 2),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        let textA = '';
        let textB = '';

        // JSON body path (the primary path per the DTO contract)
        if (isCompareRequest(req.body)) {
          textA = sanitizeText(req.body.documentA);
          textB = sanitizeText(req.body.documentB);
        } else if (Array.isArray(req.files) && req.files.length === 2) {
          // Multipart upload path
          for (let i = 0; i < 2; i += 1) {
            const file = req.files[i];
            let detected;
            try {
              detected = await fileTypeFromBuffer(file.buffer);
            } catch {
              detected = undefined;
            }
            if (!detected || !ALLOWED_MIMES.has(detected.mime)) {
              return next(unsupportedFileType());
            }
            const text = await extractText(detected.mime, file.buffer);
            const sanitised = sanitizeText(text);
            if (!isMeaningful(sanitised)) return next(scannedPdf());
            if (i === 0) textA = sanitised;
            else textB = sanitised;
          }
        } else {
          return next(
            new AppError(
              'INTERNAL_ERROR',
              400,
              'Provide two document texts as JSON { documentA, documentB } or two uploaded files.'
            )
          );
        }

        if (!isMeaningful(textA) || !isMeaningful(textB)) {
          return next(scannedPdf());
        }
        if (textA.length > config.maxExtractedChars || textB.length > config.maxExtractedChars) {
          return next(extractedTextTooLarge());
        }

        const diffs = alignAndDiff(textA, textB);
        res.json({ diffs });
      } catch {
        next(
          new AppError(
            'INTERNAL_ERROR',
            500,
            'Comparison failed. Please try again with shorter documents.'
          )
        );
      }
    }
  );

  return router;
}

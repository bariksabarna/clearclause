/**
 * POST /api/analyze route.
 *
 * Accepts a PDF/DOCX file upload or JSON `{ text }`, extracts and sanitises
 * the content, tags clauses via the LLM, applies deterministic severity and
 * inconsistency detection, and streams the result over SSE.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { loadConfig } from '../config';
import {
  scannedPdf,
  extractedTextTooLarge,
  unsupportedFileType,
  emptyDocument,
  asAppError,
} from '../errors';
import { sanitizeText, isMeaningful, detectInjectionFlag } from '../services/sanitize';
import { detectSupportedMime } from '../services/fileSignature';
import { extractText } from '../services/extractText';
import { needsChunking, chunkText, mergeChunkResults } from '../services/chunker';
import { calculateSeverity, severityReasonFor, createContentHash } from '../services/clauseTagger';
import {
  buildSummaryPrompt,
  buildTaggingPrompt,
  parseSummaryResponse,
  parseTaggingResponse,
  requestText,
  type GeminiOptions,
} from '../services/geminiClient';
import { findInconsistencies } from '../services/inconsistencyChecker';
import type { ClauseDto } from '../../shared/dto';

const sendSse = (res: Response, event: string, data: unknown): void => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

export function createAnalyzeRouter(overrides?: {
  config?: ReturnType<typeof loadConfig>;
  llmRequest?: typeof requestText;
}) {
  const config = overrides?.config ?? loadConfig();
  const llmRequest = overrides?.llmRequest ?? requestText;
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadBytes },
  });

  router.post(
    '/',
    upload.single('document'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        let rawText = '';

        if (req.file) {
          const mime = await detectSupportedMime(req.file.buffer);
          if (!mime) {
            return next(unsupportedFileType());
          }
          rawText = await extractText(mime, req.file.buffer);
        } else {
          rawText = typeof req.body?.text === 'string' ? req.body.text : '';
        }

        // Cap at ceiling + 1 so the FR-18 rejection stays detectable (a plain
        // truncation to the ceiling would silently hide over-limit documents).
        const sanitised = sanitizeText(rawText, config.maxExtractedChars + 1);
        if (!isMeaningful(sanitised)) {
          return next(req.file ? scannedPdf() : emptyDocument());
        }
        if (sanitised.length > config.maxExtractedChars) {
          return next(extractedTextTooLarge());
        }

        if (detectInjectionFlag(sanitised)) {
          console.info(
            JSON.stringify({
              level: 'info',
              timestamp: new Date().toISOString(),
              flag: 'INJECTION_ATTEMPT',
              path: req.path,
            })
          );
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        sendSse(res, 'status', { stage: 'reading' });

        const geminiOpts: GeminiOptions = {
          apiKey: config.geminiApiKey,
          model: config.geminiModel,
          fetchFn: globalThis.fetch,
        };

        let clauses: ClauseDto[];
        let summary: string;
        const chunkOpts = {
          maxWords: config.chunkThresholdWords,
          overlapWords: config.chunkOverlapWords,
        };

        if (needsChunking(sanitised, chunkOpts)) {
          sendSse(res, 'status', { stage: 'chunking' });
          const chunks = chunkText(sanitised, chunkOpts);
          const resultsPerChunk = await Promise.all(
            chunks.map(async (chunk) => {
              const raw = await llmRequest(buildTaggingPrompt(chunk), geminiOpts);
              return parseTaggingResponse(raw);
            })
          );
          clauses = mergeChunkResults(resultsPerChunk);
          const summaryRaw = await llmRequest(buildSummaryPrompt(sanitised), geminiOpts);
          summary = parseSummaryResponse(summaryRaw);
        } else {
          sendSse(res, 'status', { stage: 'analyzing' });
          const [summaryRaw, taggingRaw] = await Promise.all([
            llmRequest(buildSummaryPrompt(sanitised), geminiOpts),
            llmRequest(buildTaggingPrompt(sanitised), geminiOpts),
          ]);
          summary = parseSummaryResponse(summaryRaw);
          clauses = parseTaggingResponse(taggingRaw);
        }

        // deterministic severity override + content-hash dedup for duplicate clauses
        const cache = new Map<string, ClauseDto>();
        const tagged = clauses.map((clause) => {
          const overrideSeverity = calculateSeverity(clause.tag, clause.sourceText);
          const overrideReason = severityReasonFor(
            clause.tag,
            clause.sourceText,
            clause.severityReason
          );
          const merged: ClauseDto = {
            ...clause,
            severity: overrideSeverity,
            severityReason: overrideReason,
          };
          const key = createContentHash(clause.sourceText);
          const hit = cache.get(key);
          if (hit) return { ...merged, id: clause.id };
          cache.set(key, merged);
          return merged;
        });

        const finalClauses = tagged.map((c, idx) => ({ ...c, id: `c${idx + 1}` }));
        const inconsistencies = findInconsistencies(finalClauses);

        sendSse(res, 'clauses', { clauses: finalClauses });
        sendSse(res, 'inconsistencies', { inconsistencies });
        sendSse(res, 'summary', { summary });
        sendSse(res, 'done', { apiVersion: '1.0' });
        res.end();
      } catch (err) {
        if (!res.headersSent) {
          const error = asAppError(err);
          res.status(error.status).json(error.toJSON());
          return;
        }
        try {
          sendSse(res, 'error', { message: 'Analysis interrupted.' });
          res.end();
        } catch {
          // connection already closed
        }
      }
    }
  );

  return router;
}

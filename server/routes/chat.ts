/**
 * POST /api/chat route.
 *
 * Grounded, citation-backed Q&A. The server is stateless — the full document
 * text is sent with every request. The model is instructed to treat the
 * document as data and never follow embedded instructions (prompt injection
 * defense).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { loadConfig } from '../config';
import { AppError } from '../errors';
import { isChatRequest } from '../../shared/dto/validators';
import {
  buildChatPrompt,
  parseChatResponse,
  requestText,
  type GeminiOptions,
} from '../services/geminiClient';
import { sanitizeText } from '../services/sanitize';

export function createChatRouter(overrides?: {
  config?: ReturnType<typeof loadConfig>;
  llmRequest?: typeof requestText;
}) {
  const config = overrides?.config ?? loadConfig();
  const llmRequest = overrides?.llmRequest ?? requestText;
  const router = Router();

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body;

      if (!isChatRequest(body)) {
        return next(
          new AppError(
            'INTERNAL_ERROR',
            400,
            'Please provide a valid question with document text (sessionText).'
          )
        );
      }

      const sanitisedDoc = sanitizeText(body.sessionText, config.maxExtractedChars);
      const sanitisedQuestion = sanitizeText(body.question, 2000);

      const geminiOpts: GeminiOptions = { apiKey: config.geminiApiKey, fetchFn: globalThis.fetch };
      const raw = await llmRequest(buildChatPrompt(sanitisedDoc, sanitisedQuestion), geminiOpts);
      const result = parseChatResponse(raw);

      res.setHeader('Content-Type', 'application/json');
      res.json(result);
    } catch (err: unknown) {
      next(
        err instanceof AppError
          ? err
          : new AppError(
              'AI_UNREACHABLE',
              503,
              'The chat service is temporarily unavailable. Please try again.'
            )
      );
    }
  });

  return router;
}

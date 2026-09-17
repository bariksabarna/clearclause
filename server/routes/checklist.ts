/**
 * POST /api/checklist + POST /api/checklist/export routes.
 *
 * /api/checklist: derives an actionable checklist and lawyer-prep questions
 *   from the tagged clauses (FR-7, FR-8) deterministically.
 * /api/checklist/export: produces a downloadable text/PDF file (FR-8).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { AppError } from '../errors';
import { isChecklistRequest, isExportRequest } from '../../shared/dto/validators';
import { deriveChecklist, deriveLawyerQuestions } from '../services/checklist';
import { generateTxtExport, generatePdfExport } from '../services/exportDoc';

export function createChecklistRouter() {
  const router = Router();

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isChecklistRequest(req.body)) {
        return next(
          new AppError('INTERNAL_ERROR', 400, 'Please provide a non-empty list of tagged clauses.')
        );
      }
      const checklist = deriveChecklist(req.body.clauses);
      const lawyerQuestions = deriveLawyerQuestions(req.body.clauses);
      res.json({ checklist, lawyerQuestions });
    } catch {
      next(new AppError('INTERNAL_ERROR', 500, 'Failed to generate the checklist.'));
    }
  });

  router.post('/export', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isExportRequest(req.body)) {
        return next(
          new AppError(
            'INTERNAL_ERROR',
            400,
            'Provide checklist items, lawyer questions, and a format (txt or pdf).'
          )
        );
      }

      const { checklist, lawyerQuestions, format } = req.body;

      if (format === 'txt') {
        const buffer = generateTxtExport(checklist, lawyerQuestions);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="clearclause-checklist.txt"');
        res.send(buffer);
        return;
      }

      const buffer = await generatePdfExport(checklist, lawyerQuestions);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="clearclause-checklist.pdf"');
      res.send(buffer);
    } catch {
      next(new AppError('INTERNAL_ERROR', 500, 'Failed to generate the export file.'));
    }
  });

  return router;
}

import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createChecklistRouter } from '../server/routes/checklist';
import { errorHandler } from '../server/middleware/errorHandler';

vi.mock('../server/services/checklist', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/services/checklist')>();
  return { ...actual, deriveChecklist: vi.fn() };
});

import { deriveChecklist } from '../server/services/checklist';
const deriveChecklistMock = vi.mocked(deriveChecklist);

const validBody = {
  clauses: [
    {
      id: 'c1',
      sourceText: 'The tenant shall pay on time.',
      tag: 'Obligation',
      explanation: 'Rent is due monthly.',
      severity: 'High',
      severityReason: 'binding',
    },
  ],
};

describe('checklist derivation failures', () => {
  it('returns 500 when deriveChecklist throws', async () => {
    deriveChecklistMock.mockImplementation(() => {
      throw new Error('boom');
    });
    const app = express();
    app.use(express.json());
    app.use('/api/checklist', createChecklistRouter());
    app.use(errorHandler);
    const res = await request(app).post('/api/checklist').send(validBody);
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });
});

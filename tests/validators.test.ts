import { describe, expect, it } from 'vitest';
import {
  isAnalyzeRequest,
  isAnalysisResponse,
  isChatRequest,
  isChatResponse,
  isChecklistRequest,
  isChecklistResponse,
  isClause,
  isClauseArray,
  isClauseTag,
  isCompareRequest,
  isCompareResponse,
  isDiffItem,
  isDiffStatus,
  isErrorResponse,
  isExportFormat,
  isExportRequest,
  isInconsistency,
  isRiskSeverity,
} from '../shared/dto/validators';

const VALID_CLAUSE = {
  id: 'c1',
  sourceText: 'The tenant shall pay rent on the first of each month.',
  tag: 'Obligation',
  explanation: 'You must pay rent monthly.',
  severity: 'High',
  severityReason: 'Payment obligations are legally enforceable.',
};

describe('enum type guards', () => {
  it('isClauseTag accepts every valid tag and nothing else', () => {
    for (const tag of ['Obligation', 'Right', 'Risk', 'Standard']) {
      expect(isClauseTag(tag)).toBe(true);
    }
    expect(isClauseTag('Condition')).toBe(false);
    expect(isClauseTag(42)).toBe(false);
    expect(isClauseTag({})).toBe(false);
    expect(isClauseTag(null)).toBe(false);
  });

  it('isRiskSeverity accepts Low/Medium/High and rejects invalid', () => {
    for (const s of ['Low', 'Medium', 'High']) {
      expect(isRiskSeverity(s)).toBe(true);
    }
    expect(isRiskSeverity('Critical')).toBe(false);
    expect(isRiskSeverity(1)).toBe(false);
  });

  it('isDiffStatus accepts the four statuses and rejects the rest', () => {
    for (const s of ['added', 'removed', 'modified', 'unchanged']) {
      expect(isDiffStatus(s)).toBe(true);
    }
    expect(isDiffStatus('reordered')).toBe(false);
    expect(isDiffStatus(true)).toBe(false);
  });

  it('isExportFormat accepts pdf/txt and rejects others', () => {
    expect(isExportFormat('pdf')).toBe(true);
    expect(isExportFormat('txt')).toBe(true);
    expect(isExportFormat('docx')).toBe(false);
    expect(isExportFormat(0)).toBe(false);
  });
});

describe('isClause / isClauseArray', () => {
  it('accepts a fully valid clause', () => {
    expect(isClause(VALID_CLAUSE)).toBe(true);
  });

  it('rejects non-object values', () => {
    expect(isClause(null)).toBe(false);
    expect(isClause(undefined)).toBe(false);
    expect(isClause('text')).toBe(false);
    expect(isClause([])).toBe(false);
  });

  it('rejects clauses missing required fields', () => {
    const { id: _id, ...withoutId } = VALID_CLAUSE;
    expect(isClause(withoutId)).toBe(false);

    const { sourceText: _s, ...withoutText } = VALID_CLAUSE;
    expect(isClause(withoutText)).toBe(false);

    const { explanation: _e, ...withoutExplanation } = VALID_CLAUSE;
    expect(isClause(withoutExplanation)).toBe(false);

    const { severityReason: _r, ...withoutReason } = VALID_CLAUSE;
    expect(isClause(withoutReason)).toBe(false);
  });

  it('rejects clauses with wrong field types', () => {
    expect(isClause({ ...VALID_CLAUSE, id: 12 })).toBe(false);
    expect(isClause({ ...VALID_CLAUSE, sourceText: null })).toBe(false);
    expect(isClause({ ...VALID_CLAUSE, explanation: ['x'] })).toBe(false);
    expect(isClause({ ...VALID_CLAUSE, severityReason: true })).toBe(false);
  });

  it('rejects clauses with an out-of-enum tag or severity', () => {
    expect(isClause({ ...VALID_CLAUSE, tag: 'Condition' })).toBe(false);
    expect(isClause({ ...VALID_CLAUSE, severity: 'Critical' })).toBe(false);
  });

  it('isClauseArray accepts empty and valid arrays, rejects malformed ones', () => {
    expect(isClauseArray([])).toBe(true);
    expect(isClauseArray([VALID_CLAUSE, { ...VALID_CLAUSE, id: 'c2' }])).toBe(true);
    expect(isClauseArray([VALID_CLAUSE, { ...VALID_CLAUSE, tag: 'Bad' }])).toBe(false);
    expect(isClauseArray('not-an-array')).toBe(false);
  });
});

describe('isInconsistency', () => {
  const BODY = { clauseIds: ['c1', 'c2'], explanation: 'The dates contradict.' };

  it('accepts a valid inconsistency with 2+ ids', () => {
    expect(isInconsistency(BODY)).toBe(true);
  });

  it('rejects fewer than 2 clause ids', () => {
    expect(isInconsistency({ ...BODY, clauseIds: ['c1'] })).toBe(false);
  });

  it('rejects non-array clauseIds and non-string ids', () => {
    expect(isInconsistency({ ...BODY, clauseIds: 'c1,c2' })).toBe(false);
    expect(isInconsistency({ ...BODY, clauseIds: [1, 'c2'] })).toBe(false);
  });

  it('rejects a missing or non-string explanation', () => {
    const { explanation: _e, ...withoutExplanation } = BODY;
    expect(isInconsistency(withoutExplanation)).toBe(false);
    expect(isInconsistency({ ...BODY, explanation: 5 })).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(isInconsistency(null)).toBe(false);
  });
});

describe('request validators', () => {
  it('isAnalyzeRequest requires non-empty text', () => {
    expect(isAnalyzeRequest({ text: 'some contract text' })).toBe(true);
    expect(isAnalyzeRequest({ text: '' })).toBe(false);
    expect(isAnalyzeRequest({ text: 7 })).toBe(false);
    expect(isAnalyzeRequest({})).toBe(false);
    expect(isAnalyzeRequest(null)).toBe(false);
    expect(isAnalyzeRequest(undefined)).toBe(false);
    expect(isAnalyzeRequest('body')).toBe(false);
  });

  it('isChatRequest requires non-empty sessionText and question', () => {
    const VALID = { sessionText: 'doc text', question: 'When is rent due?' };
    expect(isChatRequest(VALID)).toBe(true);
    expect(isChatRequest({ ...VALID, sessionText: '' })).toBe(false);
    expect(isChatRequest({ ...VALID, question: '' })).toBe(false);
    expect(isChatRequest({ sessionText: 'doc text' })).toBe(false);
    expect(isChatRequest({ question: 'q' })).toBe(false);
    expect(isChatRequest([VALID])).toBe(false);
  });

  it('isChecklistRequest requires a non-empty clause array', () => {
    expect(isChecklistRequest({ clauses: [VALID_CLAUSE] })).toBe(true);
    expect(isChecklistRequest({ clauses: [] })).toBe(false);
    expect(
      isChecklistRequest({ clauses: [VALID_CLAUSE, { ...VALID_CLAUSE, severity: 'X' }] })
    ).toBe(false);
    expect(isChecklistRequest({})).toBe(false);
  });

  it('isExportRequest validates shape and format', () => {
    const VALID = { checklist: ['x'], lawyerQuestions: ['y'], format: 'pdf' };
    expect(isExportRequest(VALID)).toBe(true);
    expect(isExportRequest({ ...VALID, checklist: 'x' })).toBe(false);
    expect(isExportRequest({ ...VALID, lawyerQuestions: [1] })).toBe(false);
    expect(isExportRequest({ ...VALID, format: 'docx' })).toBe(false);
    expect(isExportRequest({ ...VALID, format: 'xlsx' })).toBe(false);
    expect(isExportRequest(null)).toBe(false);
  });

  it('isCompareRequest requires two non-empty document texts', () => {
    const VALID = { documentA: 'a', documentB: 'b' };
    expect(isCompareRequest(VALID)).toBe(true);
    expect(isCompareRequest({ ...VALID, documentA: '' })).toBe(false);
    expect(isCompareRequest({ ...VALID, documentB: '' })).toBe(false);
    expect(isCompareRequest({ documentA: 'a' })).toBe(false);
    expect(isCompareRequest({ documentA: 1, documentB: 'b' })).toBe(false);
    expect(isCompareRequest({})).toBe(false);
  });
});

describe('response validators', () => {
  it('isDiffItem validates clauseId, status, explanation', () => {
    const VALID = { clauseId: 'c1', status: 'added', explanation: 'New clause.' };
    expect(isDiffItem(VALID)).toBe(true);
    expect(isDiffItem({ ...VALID, status: 'reordered' })).toBe(false);
    expect(isDiffItem({ ...VALID, clauseId: 4 })).toBe(false);
    expect(isDiffItem({ ...VALID, explanation: undefined })).toBe(false);
    expect(isDiffItem('x')).toBe(false);
  });

  it('isAnalysisResponse validates the full analyze payload', () => {
    const VALID = {
      apiVersion: '1.0',
      summary: 'A lease agreement.',
      clauses: [VALID_CLAUSE],
      inconsistencies: [{ clauseIds: ['c1', 'c2'], explanation: 'X' }],
    };
    expect(isAnalysisResponse(VALID)).toBe(true);
    expect(isAnalysisResponse({ ...VALID, apiVersion: 1 })).toBe(false);
    expect(isAnalysisResponse({ ...VALID, summary: null })).toBe(false);
    expect(isAnalysisResponse({ ...VALID, clauses: 'none' })).toBe(false);
    expect(isAnalysisResponse({ ...VALID, clauses: [{ ...VALID_CLAUSE, tag: 'Bad' }] })).toBe(
      false
    );
    expect(isAnalysisResponse({ ...VALID, inconsistencies: 'none' })).toBe(false);
    expect(
      isAnalysisResponse({ ...VALID, inconsistencies: [{ clauseIds: ['c1'], explanation: 'X' }] })
    ).toBe(false);
    expect(isAnalysisResponse(null)).toBe(false);
  });

  it('isChatResponse validates answer and citations', () => {
    const VALID = { answer: 'Rent is due on the first.', citedClauseIds: ['c1'] };
    expect(isChatResponse(VALID)).toBe(true);
    expect(isChatResponse({ ...VALID, answer: 5 })).toBe(false);
    expect(isChatResponse({ ...VALID, citedClauseIds: 'c1' })).toBe(false);
    expect(isChatResponse({ citedClauseIds: [] })).toBe(false);
    expect(isChatResponse(undefined)).toBe(false);
  });

  it('isChecklistResponse validates both string arrays', () => {
    const VALID = { checklist: ['a'], lawyerQuestions: ['b'] };
    expect(isChecklistResponse(VALID)).toBe(true);
    expect(isChecklistResponse({ checklist: 'a', lawyerQuestions: ['b'] })).toBe(false);
    expect(isChecklistResponse({ checklist: ['a'], lawyerQuestions: null })).toBe(false);
  });

  it('isCompareResponse validates diff arrays', () => {
    const VALID = { diffs: [{ clauseId: 'c1', status: 'unchanged', explanation: 'same' }] };
    expect(isCompareResponse(VALID)).toBe(true);
    expect(isCompareResponse({ diffs: 'x' })).toBe(false);
    expect(
      isCompareResponse({ diffs: [{ clauseId: 'c1', status: 'bad', explanation: 'x' }] })
    ).toBe(false);
    expect(isCompareResponse(null)).toBe(false);
  });

  it('isErrorResponse validates code, message, and optional retryAfterMs', () => {
    const VALID = { code: 'RATE_LIMITED', message: 'Too many requests.' };
    expect(isErrorResponse(VALID)).toBe(true);
    expect(isErrorResponse({ ...VALID, retryAfterMs: 30000 })).toBe(true);
    expect(isErrorResponse({ ...VALID, retryAfterMs: 'soon' })).toBe(false);
    expect(isErrorResponse({ message: 'no code' })).toBe(false);
    expect(isErrorResponse({ code: 'X' })).toBe(false);
    expect(isErrorResponse({ code: 1, message: 'x' })).toBe(false);
    expect(isErrorResponse(undefined)).toBe(false);
  });
});

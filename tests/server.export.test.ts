// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PDFParse } from 'pdf-parse';
import { generatePdfExport, generateTxtExport } from '../server/services/exportDoc';

describe('generateTxtExport', () => {
  it('builds a numbered, sectioned plain-text document', () => {
    const buffer = generateTxtExport(
      ['Renew by May 1.', 'Notify landlord.'],
      ['Can the lease be renewed?']
    );
    const text = buffer.toString('utf-8');
    expect(text).toContain('ClearClause — Legal Document Checklist');
    expect(text).toContain('Action Items');
    expect(text).toContain('1. Renew by May 1.');
    expect(text).toContain('2. Notify landlord.');
    expect(text).toContain('Questions for Your Lawyer');
    expect(text).toContain('1. Can the lease be renewed?');
    expect(text).toContain('not legal advice');
  });
});

describe('generatePdfExport', () => {
  it('produces a valid PDF buffer whose text round-trips through extraction', async () => {
    const buffer = await generatePdfExport(['Renew the lease.'], ['What happens at expiry?']);
    expect(buffer.toString('latin1').startsWith('%PDF')).toBe(true);
    const parser = new PDFParse({ data: buffer });
    const { text } = await parser.getText();
    expect(text).toContain('ClearClause');
    expect(text).toContain('Renew the lease.');
    expect(text).toContain('What happens at expiry?');
  });
});

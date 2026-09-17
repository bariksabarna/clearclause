import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ALLOWED_UPLOAD_MIMES, detectSupportedMime } from '../server/services/fileSignature';

vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn(),
}));

import { fileTypeFromBuffer } from 'file-type';
const fileTypeMock = vi.mocked(fileTypeFromBuffer);

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('detectSupportedMime', () => {
  beforeEach(() => {
    fileTypeMock.mockReset();
  });

  it('accepts PDF magic bytes', async () => {
    fileTypeMock.mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' });
    await expect(detectSupportedMime(Buffer.from('x'))).resolves.toBe('application/pdf');
  });

  it('accepts DOCX magic bytes', async () => {
    fileTypeMock.mockResolvedValue({ mime: DOCX_MIME, ext: 'docx' });
    await expect(detectSupportedMime(Buffer.from('x'))).resolves.toBe(DOCX_MIME);
  });

  it('rejects a file that is not a supported document', async () => {
    fileTypeMock.mockResolvedValue({ mime: 'application/x-dosexec', ext: 'exe' });
    await expect(detectSupportedMime(Buffer.from('MZ fake'))).resolves.toBeNull();
  });

  it('rejects an undetectable or missing-signature file', async () => {
    fileTypeMock.mockResolvedValue(undefined);
    await expect(detectSupportedMime(Buffer.from('???'))).resolves.toBeNull();
  });

  it('rejects when the magic-byte reader itself throws', async () => {
    fileTypeMock.mockRejectedValue(new Error('bad'));
    await expect(detectSupportedMime(Buffer.from('???'))).resolves.toBeNull();
  });

  it('exposes exactly the PDF and DOCX mime types', () => {
    expect([...ALLOWED_UPLOAD_MIMES].sort()).toEqual(['application/pdf', DOCX_MIME]);
  });
});

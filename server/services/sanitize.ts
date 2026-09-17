/**
 * Sanitisation service (FR-18).
 *
 * Strips control characters without a regex (avoids the `no-control-regex`
 * ESLint rule) and enforces the hard character ceiling. Also performs a
 * lightweight, non-executing scan for prompt-injection phrasing so the
 * request can be logged with a flag.
 */

/** Threshold below which a sanitised document is treated as empty (FR-2). */
const EMPTY_DOCUMENT_CHARS = 20;

/** Phrases that suggest a prompt-injection attempt. Kept deliberately small. */
const INJECTION_PHRASES = [
  'ignore previous instructions',
  'ignore the above',
  'disregard all instructions',
];

/**
 * Remove control characters (charCode < 32 except `\n`) and trim to a ceiling.
 *
 * Newlines are preserved so document structure survives extraction.
 *
 * @param input  - Raw extracted text.
 * @param maxLen - Maximum characters to keep (default 200,000).
 * @returns The sanitised string.
 */
export function sanitizeText(input: string, maxLen = 200_000): string {
  const cleaned = input
    .split('')
    .filter((char) => char.charCodeAt(0) >= 32 || char === '\n')
    .join('');
  return cleaned.slice(0, maxLen);
}

/**
 * Whether the text counts as a usable document.
 *
 * @param text - Sanitised document text.
 * @returns True when the text has enough content to analyze.
 */
export function isMeaningful(text: string): boolean {
  return text.trim().length >= EMPTY_DOCUMENT_CHARS;
}

/**
 * Non-executing detection of prompt-injection phrasing.
 *
 * Used only to attach a flag to the request's metadata log. The content is
 * treated as data regardless of this flag; no "instruction" is ever run.
 *
 * @param text - Sanitised document text.
 * @returns True when an injection-style phrase is present.
 */
export function detectInjectionFlag(text: string): boolean {
  const lower = text.toLowerCase();
  return INJECTION_PHRASES.some((phrase) => lower.includes(phrase));
}

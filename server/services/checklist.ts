/**
 * Checklist generation service (FR-7, FR-8).
 *
 * Derives actionable items and lawyer-prep questions directly from the tagged
 * clauses. For the Must-have scope this is deterministic — the LLM prompt
 * exists in the PRD but every derivation path is pure and testable.
 */
import type { ClauseDto } from '../../shared/dto';

/**
 * Derive a practical checklist from tagged clauses.
 *
 * An item is produced for every High/Medium-severity obligation or risk
 * clause. The phrasing is template-based and free of jargon (FR-7).
 *
 * @param clauses - Tagged clauses from the analysis result.
 * @returns Non-empty action items.
 */
export function deriveChecklist(clauses: ClauseDto[]): string[] {
  return clauses
    .filter(
      (clause) =>
        clause.severity === 'High' || clause.severity === 'Medium' || clause.tag === 'Obligation'
    )
    .map((clause) => {
      const shortExplanation = clause.explanation.slice(0, 200);
      if (clause.tag === 'Obligation') {
        return `Review: ${shortExplanation} (Clause ${clause.id})`;
      }
      return `Check risk: ${shortExplanation} (Clause ${clause.id})`;
    });
}

/**
 * Generate questions a non-lawyer should ask their lawyer (FR-8).
 *
 * At least one question is produced for every flagged risk clause; obligation
 * and right clauses generate optional questions when the text hints at a
 * penalty or limitation.
 *
 * @param clauses - Tagged clauses from the analysis result.
 * @returns Non-empty lawyer-prep questions.
 */
export function deriveLawyerQuestions(clauses: ClauseDto[]): string[] {
  const questions: string[] = [];

  for (const clause of clauses) {
    const short = clause.sourceText.slice(0, 200);
    if (clause.tag === 'Risk') {
      questions.push(
        `What are the practical consequences of this clause? "${short}" (Clause ${clause.id})`
      );
    }
    if (clause.tag === 'Obligation' && clause.severity === 'High') {
      questions.push(
        `Can this obligation be negotiated or removed? "${short}" (Clause ${clause.id})`
      );
    }
  }

  if (questions.length === 0) {
    questions.push(
      'Are there any standard terms in this document that should be reviewed by a legal professional?'
    );
  }

  return questions;
}

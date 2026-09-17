/**
 * Shared Data Transfer Objects for ClearClause.
 *
 * Single source of truth for every payload exchanged between the React
 * client and the Express API. Consists of:
 *  - `enums.ts`            — runtime constants + literal unions
 *  - `clause.dto.ts`       — Clause, Inconsistency, ChatTurn
 *  - `request.dto.ts`      — request body shapes for all endpoints
 *  - `response.dto.ts`     — response shapes for all endpoints
 *  - `validators.ts`       — pure runtime guards for every shape (unit-testable)
 *
 * Use across client and server. The validators are dependency-free so they
 * run in any environment (Node, browser, or test runner).
 */

export * from './clause.dto';
export * from './request.dto';
export * from './response.dto';
export * from './enums';
export * from './validators';

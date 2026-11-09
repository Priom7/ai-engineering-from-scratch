import type { Email } from '../store.js';
import type { Outcome, RunRecord } from '../workflow/types.js';

// Grading for the experiments, using the Episode 3 approach: fact checks in
// code, and a judge with a rubric where meaning matters. The number that matters
// most for a support desk: wrong replies that would have reached a customer.

export type EmailResult = {
  emailId: string;
  mode: RunRecord['mode'];
  outcome: Outcome;
  expectedRoute: string;
  /** Escalated when it should be (an outage), and not escalated or failed otherwise. */
  escalationCorrect: boolean;
  /** Whether the drafted reply is correct (null when there is no reply, e.g. escalated). */
  replyCorrect: boolean | null;
  /** A wrong reply that went out. */
  sentWrong: boolean;
  /** A wrong reply that was stopped for review. */
  caught: boolean;
  intentCorrect: boolean | null;
  jsonFirstTry: boolean | null;
  jsonAttempts: number | null;
  durationMs: number;
  stepMs: Record<string, number>;
};

/** Where a graded reply ended up: sent to the customer wrong, or stopped for review. */
const verdictFlags = (outcome: Outcome, replyCorrect: boolean | null) => ({
  replyCorrect,
  sentWrong: outcome === 'ready' && replyCorrect === false,
  caught: outcome === 'review' && replyCorrect === false,
});

export function gradeOutcome(email: Email, run: RunRecord, replyCorrect: boolean | null): EmailResult {
  // TODO: Turn one run into an EmailResult (see the type above).
  // - escalationCorrect: escalated when the email is an outage (expected.route is 'escalated'),
  //   and otherwise neither escalated nor failed
  // - replyCorrect, sentWrong and caught: use verdictFlags(run.outcome, replyCorrect)
  // - intentCorrect, jsonFirstTry and jsonAttempts come from the 'understand' step (null without one)
  // - stepMs: each step's durationMs, by nodeId
  throw new Error('TODO: gradeOutcome');
}

/** A saved result with a new verdict on its reply, e.g. after a rubric changes. Nothing is run again. */
export function regradeResult<T extends EmailResult>(result: T, replyCorrect: boolean | null): T {
  return { ...result, ...verdictFlags(result.outcome, replyCorrect) };
}

const round = (value: number) => Math.round(value * 100) / 100;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function summarizeExperiment(results: EmailResult[]) {
  const count = (pick: (r: EmailResult) => boolean) => results.filter(pick).length;
  const withJson = results.filter((r) => r.jsonAttempts !== null);
  const steps = [...new Set(results.flatMap((r) => Object.keys(r.stepMs)))];
  const seconds = (ms: number | null) => (ms === null ? null : round(ms / 1000));
  return {
    emails: results.length,
    sentWrong: count((r) => r.sentWrong),
    sentRight: count((r) => r.outcome === 'ready' && r.replyCorrect === true),
    caught: count((r) => r.caught),
    ready: count((r) => r.outcome === 'ready'),
    review: count((r) => r.outcome === 'review'),
    escalated: count((r) => r.outcome === 'escalated'),
    failed: count((r) => r.outcome === 'failed'),
    escalationCorrect: count((r) => r.escalationCorrect),
    /** Correct drafts that still went to a person: the price of checking. */
    reviewedButCorrect: count((r) => r.outcome === 'review' && r.replyCorrect === true),
    intentAccuracy: withJson.length ? round(withJson.filter((r) => r.intentCorrect).length / withJson.length) : null,
    jsonFirstTry: withJson.length ? round(withJson.filter((r) => r.jsonFirstTry).length / withJson.length) : null,
    jsonAfterRetry: withJson.length ? round(withJson.filter((r) => r.outcome !== 'failed' && r.jsonAttempts !== null).length / withJson.length) : null,
    medianSeconds: seconds(median(results.map((r) => r.durationMs))),
    stepMedians: Object.fromEntries(steps.map((s) => [s, seconds(median(results.filter((r) => s in r.stepMs).map((r) => r.stepMs[s])))])),
  };
}

// --- Reply grading (from Episode 3) ---

function words(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return normalized ? normalized.split(' ') : [];
}

/** True when any "|"-separated alternative appears as whole words. */
export function containsPhrase(text: string, phrase: string): boolean {
  const textWords = words(text);
  return phrase
    .split('|')
    .map(words)
    .filter((a) => a.length > 0)
    .some((alternative) => {
      for (let start = 0; start + alternative.length <= textWords.length; start += 1) {
        if (alternative.every((w, i) => textWords[start + i] === w)) return true;
      }
      return false;
    });
}

export const GRADE_FORMAT = {
  type: 'object',
  properties: { reason: { type: 'string' }, verdict: { type: 'string', enum: ['pass', 'fail'] } },
  required: ['reason', 'verdict'],
};

export function gradeMessages(email: string, rubric: string, reply: string) {
  return {
    system:
      'You grade customer support replies for an automated test. Judge only whether the reply meets the rubric. ' +
      'First compare the reply with the rubric, then decide. Reply with JSON: {"reason": "one or two sentences", "verdict": "pass" or "fail"}.',
    user: `Customer email:\n${email}\n\nRubric:\n${rubric}\n\nReply to grade:\n${reply}`,
  };
}

export function parseVerdict(text: string): { passed: boolean; reason: string } {
  try {
    const data = JSON.parse(text) as { verdict?: unknown; reason?: unknown };
    return { passed: data.verdict === 'pass', reason: typeof data.reason === 'string' ? data.reason : '' };
  } catch {
    return { passed: false, reason: `Grader reply was not JSON: ${text.slice(0, 80)}` };
  }
}

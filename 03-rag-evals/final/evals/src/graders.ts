import type { Question } from './types.js';

// Graders turn one answer into pass or fail. Cheap code checks come first;
// the LLM judge is only for answers where meaning matters.

function words(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  return normalized ? normalized.split(' ') : [];
}

/**
 * True when any "|"-separated alternative of `phrase` appears in `text` as whole words.
 * It only checks that a fact is there. It can't tell "yes" from "no", so yes/no questions go to the judge.
 */
export function containsPhrase(text: string, phrase: string): boolean {
  const textWords = words(text);
  return phrase
    .split('|')
    .map(words)
    .filter((alternative) => alternative.length > 0)
    .some((alternative) => {
      for (let start = 0; start + alternative.length <= textWords.length; start += 1) {
        if (alternative.every((word, offset) => textWords[start + offset] === word)) return true;
      }
      return false;
    });
}

export function gradeFacts(answer: string, mustSay: string[]): { passed: boolean; reason: string } {
  const missing = mustSay.filter((phrase) => !containsPhrase(answer, phrase));
  return missing.length === 0
    ? { passed: true, reason: 'Says every required fact.' }
    : { passed: false, reason: `Missing: ${missing.map((m) => `"${m}"`).join(', ')}.` };
}

const squash = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

/** True when any retrieved chunk contains any evidence phrase (ignoring case and line breaks). */
export function retrievalHit(chunkTexts: string[], evidence: string[]): boolean {
  const chunks = chunkTexts.map(squash);
  return evidence.map(squash).some((phrase) => chunks.some((chunk) => chunk.includes(phrase)));
}

export const REFUSE_RUBRIC =
  "The documents do not answer this question. Pass if the answer says the documents or the context don't mention it, or that the information couldn't be found. Mentioning related facts that are in the documents is fine. Fail if the answer claims something the documents don't say, such as a yes or no, a number, a name, an address or a policy.";

const JUDGE_SYSTEM =
  'You grade answers from a document question-answering assistant for an automated test. ' +
  'Judge only whether the answer meets the rubric. Use the reference answer and the context as the source of truth, not your own knowledge. ' +
  'First compare the answer with the reference and the rubric, then decide. ' +
  'Reply with JSON: {"reason": "one or two sentences", "verdict": "pass" or "fail"}.';

export function judgeMessages(question: Question, answer: string, context: string): { system: string; user: string } {
  const grade = question.grade;
  const reference = grade.type === 'judge' ? grade.reference : "The documents don't say.";
  const rubric = grade.type === 'judge' ? grade.rubric : REFUSE_RUBRIC;
  return {
    system: JUDGE_SYSTEM,
    user: [
      `Question:\n${question.question}`,
      `Context the assistant had:\n${context}`,
      `Reference answer:\n${reference}`,
      `Rubric:\n${rubric}`,
      `Answer to grade:\n${answer}`,
    ].join('\n\n'),
  };
}

/** The reason comes first, so the judge reasons before it decides. A word verdict flips less often than a bare true/false. */
export const JUDGE_FORMAT = {
  type: 'object',
  properties: { reason: { type: 'string' }, verdict: { type: 'string', enum: ['pass', 'fail'] } },
  required: ['reason', 'verdict'],
};

/** Anything other than valid JSON with the verdict "pass" counts as a fail, never a pass. */
export function parseJudge(text: string): { passed: boolean; reason: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { passed: false, reason: `Judge reply was not JSON: ${text.slice(0, 80)}` };
  }
  const record = data as { verdict?: unknown; reason?: unknown };
  const reason = typeof record?.reason === 'string' ? record.reason : '';
  if (record?.verdict !== 'pass' && record?.verdict !== 'fail') {
    return { passed: false, reason: `Judge reply had no pass/fail verdict. ${reason}`.trim() };
  }
  return { passed: record.verdict === 'pass', reason };
}

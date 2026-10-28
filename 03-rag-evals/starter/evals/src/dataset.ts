import type { Question } from './types.js';

const GRADE_TYPES = new Set(['facts', 'judge', 'refuse']);

/** Checks the dataset file's shape, so a typo fails loudly with the question's id. */
export function validateDataset(raw: unknown): { questions: Question[] } | { error: string } {
  const questions = (raw as { questions?: unknown })?.questions;
  if (!Array.isArray(questions)) return { error: 'The dataset needs a "questions" array.' };

  const seen = new Set<string>();
  for (const q of questions as Question[]) {
    const id = q?.id ?? '(no id)';
    if (!q?.id || !q.question) return { error: `${id}: every question needs an id and a question.` };
    if (seen.has(q.id)) return { error: `${id}: duplicate id.` };
    seen.add(q.id);

    if (!GRADE_TYPES.has(q.grade?.type)) return { error: `${id}: unknown grade type "${q.grade?.type}".` };
    const answerable = q.source !== null;
    if (answerable && (!Array.isArray(q.evidence) || q.evidence.length === 0)) {
      return { error: `${id}: an answerable question needs at least one evidence phrase.` };
    }
    if (answerable && q.grade.type === 'refuse') return { error: `${id}: only unanswerable questions use "refuse".` };
    if (!answerable && q.grade.type !== 'refuse') return { error: `${id}: an unanswerable question must use "refuse".` };
    if (q.grade.type === 'facts' && !(q.grade.mustSay?.length > 0)) return { error: `${id}: "facts" needs mustSay phrases.` };
    if (q.grade.type === 'judge' && (!q.grade.reference || !q.grade.rubric)) {
      return { error: `${id}: "judge" needs a reference and a rubric.` };
    }
  }
  return { questions: questions as Question[] };
}

/** The questions to run: all of them, or only the ids asked for (e.g. `--only student-discount`). */
export function selectQuestions(questions: Question[], only: string[] | undefined): Question[] {
  if (!only || only.length === 0) return questions;
  const known = new Set(questions.map((q) => q.id));
  const unknown = only.filter((id) => !known.has(id));
  if (unknown.length > 0) throw new Error(`Unknown question id: ${unknown.join(', ')}`);
  return questions.filter((q) => only.includes(q.id));
}

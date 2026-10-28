import type { Change } from './compare.js';
import type { RunFile } from './types.js';

// Plain-text reports for the terminal.

const pct = (value: number | null) => (value === null ? '–' : `${Math.round(value * 100)}%`);
const pad = (text: string, width: number) => text.padEnd(width);

function tally(run: RunFile, kind: 'answerable' | 'unanswerable' | 'all') {
  const rows = run.summary.questions.filter((q) => kind === 'all' || q.kind === kind);
  return { passes: rows.reduce((n, q) => n + q.passes, 0), attempts: rows.reduce((n, q) => n + q.attempts, 0) };
}

export function formatRun(run: RunFile): string {
  const s = run.settings;
  const sum = run.summary;
  const answerable = sum.questions.filter((q) => q.kind === 'answerable');
  const found = answerable.filter((q) => q.hit).length;
  const lines = [
    `Fernhill evals: ${run.config}`,
    `${s.chatModel} · chunks ${s.chunkSize}/${s.chunkOverlap} · top ${s.topK} · ${s.repeats} repeats · judge ${s.judgeModel}`,
    '',
    answerable.length === 0
      ? '  Retrieval   found the right paragraph     –       (no answerable questions in this run)'
      : `  Retrieval   found the right paragraph     ${pad(`${found}/${answerable.length}`, 7)} ${pct(sum.retrievalHitRate)}`,
  ];

  if (sum.overallPassRate !== null) {
    const a = tally(run, 'answerable');
    const u = tally(run, 'unanswerable');
    const all = tally(run, 'all');
    lines.push(
      `  Answers     correct                       ${pad(`${a.passes}/${a.attempts}`, 7)} ${pct(sum.answerPassRate)}`,
      `  Honesty     said it isn't in the docs     ${pad(`${u.passes}/${u.attempts}`, 7)} ${pct(sum.honestyPassRate)}`,
      `  Overall                                   ${pad(`${all.passes}/${all.attempts}`, 7)} ${pct(sum.overallPassRate)}`,
      `  Speed       median seconds per answer     ${sum.medianSeconds?.toFixed(1)} s`,
    );
  }

  for (const kind of ['answerable', 'unanswerable'] as const) {
    lines.push('', kind === 'answerable' ? '  answerable' : '  not in the documents');
    for (const q of sum.questions.filter((row) => row.kind === kind)) {
      const marks = run.attempts.filter((a) => a.questionId === q.id).map((a) => (a.passed ? '●' : '○')).join('');
      const hit = q.hit === null ? '       ' : q.hit ? 'found  ' : 'MISSED ';
      lines.push(`  ${pad(q.id, 24)} ${hit} ${pad(marks, 6)} ${q.attempts ? `${q.passes}/${q.attempts}` : ''}`.trimEnd());
    }
  }
  return lines.join('\n');
}

export function formatCompare(base: RunFile, target: RunFile, rows: { id: string; base: number; target: number; change: Change }[]): string {
  const count = (change: Change) => rows.filter((r) => r.change === change).length;
  const lines = [
    `${base.config} → ${target.config}`,
    '',
    `  improved   ${count('improved')}`,
    `  regressed  ${count('regressed')}`,
    `  unchanged  ${count('unchanged')}`,
    '',
  ];
  for (const r of rows.filter((row) => row.change !== 'unchanged')) {
    lines.push(`  ${r.change === 'improved' ? '▲' : '▼'} ${pad(r.id, 24)} ${pct(r.base).padStart(4)} → ${pct(r.target).padStart(4)}`);
  }
  const b = base.summary;
  const t = target.summary;
  lines.push(
    '',
    `  Retrieval  ${pct(b.retrievalHitRate).padStart(4)} → ${pct(t.retrievalHitRate)}`,
    `  Overall    ${pct(b.overallPassRate).padStart(4)} → ${pct(t.overallPassRate)}`,
    `  Speed      ${b.medianSeconds?.toFixed(1)} s → ${t.medianSeconds?.toFixed(1)} s per answer`,
  );
  return lines.join('\n');
}

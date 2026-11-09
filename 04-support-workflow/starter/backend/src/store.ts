import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { RunRecord } from './workflow/types.js';

// Files on disk: the sample emails, emails pasted into the app, and every run.

export type Expected = {
  intent: string;
  route: 'ready' | 'review' | 'escalated';
  mustSay?: string[];
  rubric?: string;
  refuse?: boolean;
};

export type Email = { id: string; from: string; subject: string; body: string; expected?: Expected; pasted?: boolean };

/** Ids become file names, so they may only contain letters, digits, _ and -. */
const SAFE_ID = /^[\w-]+$/;
const MAX_BODY = 8000;

export function createStore(dataDir: string) {
  const runsDir = path.join(dataDir, 'runs');
  const inboxFile = path.join(dataDir, 'inbox.json');

  async function readJson<T>(file: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await readFile(file, 'utf8')) as T;
    } catch {
      return fallback;
    }
  }

  async function listEmails(): Promise<Email[]> {
    const samples = await readJson<{ emails: Email[] }>(path.join(dataDir, 'emails.json'), { emails: [] });
    const pasted = await readJson<Email[]>(inboxFile, []);
    return [...pasted, ...samples.emails];
  }

  async function addEmail(input: { from: string; subject: string; body: string }): Promise<Email> {
    const body = input.body.trim();
    if (!body) throw new Error('The email body is empty.');
    if (body.length > MAX_BODY) throw new Error(`The email is too long (${body.length} characters; the limit is ${MAX_BODY}).`);
    const email: Email = {
      id: `pasted-${Date.now()}-${randomBytes(2).toString('hex')}`,
      from: input.from.trim() || 'Customer',
      subject: input.subject.trim() || '(no subject)',
      body,
      pasted: true,
    };
    const pasted = await readJson<Email[]>(inboxFile, []);
    await mkdir(dataDir, { recursive: true });
    await writeFile(inboxFile, JSON.stringify([email, ...pasted], null, 2));
    return email;
  }

  async function saveRun(run: RunRecord) {
    if (!SAFE_ID.test(run.id)) throw new Error(`Unsafe run id: ${run.id}`);
    await mkdir(runsDir, { recursive: true });
    await writeFile(path.join(runsDir, `${run.id}.json`), JSON.stringify(run, null, 2));
  }

  async function readRun(id: string): Promise<RunRecord | null> {
    if (!SAFE_ID.test(id)) return null;
    return readJson<RunRecord | null>(path.join(runsDir, `${id}.json`), null);
  }

  /** Newest first, without the step details. */
  async function listRuns() {
    let files: string[] = [];
    try {
      files = (await readdir(runsDir)).filter((f) => f.endsWith('.json'));
    } catch {
      return [];
    }
    const runs = await Promise.all(files.map((f) => readJson<RunRecord | null>(path.join(runsDir, f), null)));
    return runs
      .filter((r): r is RunRecord => r !== null)
      .map(({ steps: _steps, context: _context, ...summary }) => summary)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  return { listEmails, addEmail, saveRun, readRun, listRuns };
}

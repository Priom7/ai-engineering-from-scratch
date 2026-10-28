import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Read-only access to the eval runs saved by `npm run eval` (evals/results/*.json),
// so the app can show them in its Evals view.

type SavedRun = {
  config: string;
  createdAt: string;
  settings: { chatModel: string; repeats: number };
  summary: {
    retrievalHitRate: number;
    answerPassRate: number | null;
    honestyPassRate: number | null;
    overallPassRate: number | null;
    medianSeconds: number | null;
  };
  attempts: unknown[];
};

export type RunListing = {
  name: string;
  config: string;
  createdAt: string;
  chatModel: string;
  repeats: number;
  retrievalHitRate: number;
  answerPassRate: number | null;
  honestyPassRate: number | null;
  overallPassRate: number | null;
  medianSeconds: number | null;
};

/** Result names are plain file names; anything else could point outside the results folder. */
const SAFE_NAME = /^[\w-]+$/;

/** One line per saved run, newest first. Attempts are left out to keep the list small. */
export async function listRuns(dir: string): Promise<RunListing[]> {
  let files: string[];
  try {
    files = (await readdir(dir)).filter((file) => file.endsWith('.json'));
  } catch {
    return [];
  }
  const runs = await Promise.all(
    files.map(async (file) => {
      const run = JSON.parse(await readFile(path.join(dir, file), 'utf8')) as SavedRun;
      const { retrievalHitRate, answerPassRate, honestyPassRate, overallPassRate, medianSeconds } = run.summary;
      return {
        name: file.replace(/\.json$/, ''),
        config: run.config,
        createdAt: run.createdAt,
        chatModel: run.settings.chatModel,
        repeats: run.settings.repeats,
        retrievalHitRate,
        answerPassRate,
        honestyPassRate,
        overallPassRate,
        medianSeconds,
      };
    }),
  );
  return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The full run, with every attempt, or null when there is no such run. */
export async function readRun(dir: string, name: string): Promise<SavedRun | null> {
  if (!SAFE_NAME.test(name)) return null;
  try {
    return JSON.parse(await readFile(path.join(dir, `${name}.json`), 'utf8')) as SavedRun;
  } catch {
    return null;
  }
}

import { readFileSync } from 'node:fs';

import type { Workflow } from './types.js';

/** Reads a workflow file and checks that the start node and every edge point at real nodes. */
export function loadWorkflow(file: string): Workflow {
  const workflow = JSON.parse(readFileSync(file, 'utf8')) as Workflow;
  const ids = new Set(workflow.nodes.map((n) => n.id));
  if (!ids.has(workflow.start)) throw new Error(`Workflow ${workflow.id}: start node "${workflow.start}" does not exist.`);
  for (const edge of workflow.edges) {
    for (const end of [edge.from, edge.to]) {
      if (!ids.has(end)) throw new Error(`Workflow ${workflow.id}: edge ${edge.id} points at "${end}", which does not exist.`);
    }
  }
  return workflow;
}
